import { afterEach, describe, expect, it, vi } from "vitest";
import { analyze } from "@/lib/fix/report";
import { samples } from "@/lib/fixtures";
import { fixtureProvider } from "@/lib/market/fixture";
import { alpacaProvider } from "@/lib/market/alpaca";
import { compare } from "@/lib/market/compare";
import { POST } from "@/app/api/market/route";
const report = analyze(samples[0].text);
const buy = report.orders.find((o) => o.side === "buy")!;
const sell = report.orders.find((o) => o.side === "sell")!;
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("historical comparison", () => {
  it("uses last completed bar, execution time, and exact side-aware calculations", async () => {
    const e = buy.events.find((e) => e.execId?.endsWith("F2"))!;
    const ref = await fixtureProvider.lookup({
      symbol: e.symbol,
      timestamp: e.timestamp,
    });
    const c = compare(buy, e, ref);
    expect(c).toMatchObject({
      referenceTimestamp: "2025-01-15T15:31:00.000Z",
      referenceEndTimestamp: "2025-01-15T15:32:00.000Z",
      distanceMs: 10000,
      difference: "0.75",
      adverseBps: "39.421813",
      flagged: true,
      provider: "fixture",
    });
  });
  it("reverses adverse difference for sells", async () => {
    const e = sell.events.find((e) => e.execId?.endsWith("F1"))!;
    const c = compare(
      sell,
      e,
      await fixtureProvider.lookup({
        symbol: e.symbol,
        timestamp: e.timestamp,
      }),
    );
    expect(c.difference).toBe("0.5");
    expect(c.adverseDifference).toBe("-0.5");
    expect(c.flagged).toBe(false);
  });
  it("rejects future bars and does not use the latest market price", async () => {
    const e = buy.events.find((e) => e.execType === "F")!;
    const ref = await fixtureProvider.lookup({
      symbol: e.symbol,
      timestamp: e.timestamp,
    });
    expect(() =>
      compare(buy, e, {
        ...ref,
        timestamp: "2025-01-15T15:31:00.000Z",
        endTimestamp: "2025-01-15T15:32:00.000Z",
      }),
    ).toThrow(/future/);
  });
  it("does not fabricate prices for unsupported dates or symbols", async () => {
    await expect(
      fixtureProvider.lookup({
        symbol: "AAPL",
        timestamp: "2025-01-18T12:00:00Z",
      }),
    ).rejects.toThrow();
  });
  it("bounds Alpaca query and uses explicit IEX headers and completed bars", async () => {
    vi.stubEnv("ALPACA_API_KEY", "test-key");
    vi.stubEnv("ALPACA_API_SECRET", "test-secret");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          bars: { AAPL: [{ t: "2025-01-15T15:31:00Z", c: 190.25 }] },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const ref = await alpacaProvider.lookup({
      symbol: "AAPL",
      timestamp: "2025-01-15T15:32:10.000Z",
    });
    const [url, options] = fetchMock.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/v2/stocks/bars");
    expect(parsed.searchParams.get("feed")).toBe("iex");
    expect(parsed.searchParams.get("limit")).toBe("6");
    expect(parsed.searchParams.get("end")).toBe("2025-01-15T15:31:59.999Z");
    expect(options.headers["APCA-API-KEY-ID"]).toBe("test-key");
    expect(ref.provider).toBe("alpaca");
  });
  it.each([429, 403, 500])(
    "surfaces Alpaca status %s without fixture substitution",
    async (status) => {
      vi.stubEnv("ALPACA_API_KEY", "test-key");
      vi.stubEnv("ALPACA_API_SECRET", "test-secret");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("", { status })),
      );
      await expect(
        alpacaProvider.lookup({
          symbol: "AAPL",
          timestamp: "2025-01-15T15:32:10.000Z",
        }),
      ).rejects.toThrow(/Alpaca/);
    },
  );
  it("handles timeouts", async () => {
    vi.stubEnv("ALPACA_API_KEY", "test-key");
    vi.stubEnv("ALPACA_API_SECRET", "test-secret");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    await expect(
      alpacaProvider.lookup({
        symbol: "AAPL",
        timestamp: "2025-01-15T15:32:10.000Z",
      }),
    ).rejects.toThrow(/timed out/);
  });
  it("keeps core analysis available when external credentials are missing", async () => {
    vi.stubEnv("ALPACA_API_KEY", "");
    vi.stubEnv("ALPACA_API_SECRET", "");
    const r = await POST(
      new Request("http://test/api/market", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: samples[0].text,
          provider: "alpaca",
          sourceId: buy.events.find((e) => e.execType === "F")!.sourceId,
        }),
      }),
    );
    expect(r.status).toBe(503);
    expect(analyze(samples[0].text).summary.observedFilledQty).toBe("150");
  });
});
