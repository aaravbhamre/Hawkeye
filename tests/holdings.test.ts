import { describe, expect, it, vi, afterEach } from "vitest";
import { analyze } from "@/lib/fix/report";
import { holdings } from "@/lib/holdings/accounting";
import { injectFault, lifecycle, samples } from "@/lib/fixtures";
import { latestPrices } from "@/lib/market/latest";
import { POST } from "@/app/api/holdings/route";
const demo = samples.find((s) => s.id === "holdings")!.text;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("deterministic moving weighted-average holdings", () => {
  it("does not infer zero opening positions", () => {
    const result = holdings(analyze(demo));
    expect(result.summary.marketValue).toBeNull();
    expect(
      result.holdings.every((h) => h.averageCost === null && !h.complete),
    ).toBe(true);
  });
  it("reduces cost proportionally for sells, independently of sale price", async () => {
    const result = holdings(
      analyze(demo),
      true,
      await latestPrices(["AAPL", "MSFT"], "fixture"),
    );
    expect(result.holdings.find((h) => h.symbol === "AAPL")).toMatchObject({
      netQuantity: "75",
      averageCost: "190.6",
      costBasis: "14295",
      marketValue: "14625",
      unrealizedPnl: "330",
      unrealizedPercent: "2.308499",
    });
    expect(result.holdings.find((h) => h.symbol === "MSFT")).toMatchObject({
      netQuantity: "50",
      costBasis: "20970",
      marketValue: "20750",
      unrealizedPnl: "-220",
    });
    expect(result.summary).toMatchObject({
      complete: true,
      marketValue: "35375",
      unrealizedPnl: "110",
    });
  });
  it("duplicate delivery and shuffled delivery preserve quantities and basis", () => {
    const expected = holdings(analyze(demo), true).holdings.map(
      ({ sourceIds, ...h }) => ({ ...h, sourceCount: sourceIds.length }),
    );
    for (const fault of ["duplicate", "shuffle"] as const)
      expect(
        holdings(analyze(injectFault(demo, fault)), true).holdings.map(
          ({ sourceIds, ...h }) => ({ ...h, sourceCount: sourceIds.length }),
        ),
      ).toEqual(expected);
    expect(holdings(analyze(demo), true)).toEqual(
      holdings(analyze(demo), true),
    );
  });
  it("keeps independent sessions separate", () => {
    const result = holdings(
      analyze(samples.find((s) => s.id === "sessions")!.text),
      true,
    );
    expect(result.holdings).toHaveLength(2);
    expect(result.holdings.map((h) => h.netQuantity)).toEqual(["100", "100"]);
  });
  it("does not invent cost for sell-only inventory, incomplete orders or disputes", () => {
    const result = holdings(analyze(samples[0].text), true);
    expect(result.holdings.find((h) => h.symbol === "MSFT")).toMatchObject({
      netQuantity: "-50",
      averageCost: null,
      complete: false,
    });
    for (const id of ["missing-ack", "missing-request", "conflict"])
      expect(
        holdings(
          analyze(samples.find((s) => s.id === id)!.text),
          true,
        ).holdings.every((h) => !h.complete),
      ).toBe(true);
  });
  it("propagates an orphan non-fill response into its affected book", () => {
    const capture = [
      ...lifecycle(),
      lifecycle(
        "ORPHAN",
        "DEMO",
        "AAPL",
        "1",
        "100",
        "40",
        "190",
        "191",
        "190.6",
        20,
      )[1],
    ].join("\n");
    expect(holdings(analyze(capture), true).holdings[0]).toMatchObject({
      complete: false,
      netQuantity: "100",
      averageCost: null,
    });
  });
  it("does not count unfilled requests or canceled remainders", () => {
    expect(
      holdings(analyze(lifecycle().slice(0, 2).join("\n")), true).holdings,
    ).toEqual([]);
    expect(
      holdings(analyze(samples.find((s) => s.id === "cancel")!.text), true)
        .holdings[0].netQuantity,
    ).toBe("40");
  });
  it("rejects ambiguous cross-order buy/sell chronology", () => {
    const sameTime = demo
      .replaceAll("15:34:10.000", "15:31:10.000")
      .replaceAll("15:33:00.000", "15:30:00.000")
      .replaceAll("15:33:00.020", "15:30:00.020")
      .replaceAll("34=21|", "34=2|");
    expect(
      holdings(analyze(sameTime), true).holdings.find(
        (h) => h.symbol === "AAPL",
      )!.complete,
    ).toBe(false);
  });
  it("withholds unsupported assets and prices predating executions", async () => {
    const report = analyze(
      lifecycle().join("\n").replaceAll("55=AAPL|", "55=AAPL|15=EUR|"),
    );
    expect(holdings(report, true).holdings[0].complete).toBe(false);
    const prices = await latestPrices(["AAPL"], "fixture");
    prices[0].timestamp = "2024-01-01T00:00:00.000Z";
    expect(
      holdings(analyze(lifecycle().join("\n")), true, prices).summary
        .marketValue,
    ).toBeNull();
  });
  it("does exact fractional arithmetic and supports fully closed positions", () => {
    const fractional = lifecycle(
      "F",
      "D",
      "AAPL",
      "1",
      "0.3",
      "0.1",
      "0.1",
      "0.1",
      "0.1",
    ).join("\n");
    expect(holdings(analyze(fractional), true).holdings[0]).toMatchObject({
      netQuantity: "0.3",
      averageCost: "0.1",
      costBasis: "0.03",
    });
    const closed = demo
      .replaceAll("38=25|", "38=100|")
      .replaceAll("151=25|", "151=100|")
      .replaceAll("32=15|", "32=90|")
      .replaceAll("14=25|", "14=100|")
      .replaceAll("151=15|", "151=90|");
    expect(
      holdings(analyze(closed), true).holdings.find((h) => h.symbol === "AAPL"),
    ).toMatchObject({
      netQuantity: "0",
      costBasis: "0",
      marketValue: "0",
      unrealizedPnl: "0",
    });
  });
  it("API recomputes evidence, exports fixture provenance and tolerates market failure", async () => {
    const request = (provider = "fixture") =>
      new Request("http://test/api/holdings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: demo,
          zeroOpeningPositions: true,
          provider,
          refresh: true,
          marketValue: "999999",
        }),
      });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).summary.marketValue).toBe("35375");
    vi.stubEnv("ALPACA_API_KEY", "");
    vi.stubEnv("ALPACA_API_SECRET", "");
    const failed = await POST(request("alpaca"));
    const result = await failed.json();
    expect(failed.status).toBe(200);
    expect(result.priceError).toMatch(/credentials/);
    expect(result.holdings[0].netQuantity).toBe("75");
    expect(result.summary.marketValue).toBeNull();
  });
});
describe("bounded latest-price market adapter", () => {
  it("batches snapshots and history and preserves timestamps", async () => {
    vi.stubEnv("ALPACA_API_KEY", "test-key");
    vi.stubEnv("ALPACA_API_SECRET", "test-secret");
    const fetch = vi.fn(async (input: string) =>
      Response.json(
        input.includes("snapshots")
          ? { AAPL: { latestTrade: { p: 195, t: "2025-01-15T21:00:00Z" } } }
          : {
              bars: {
                AAPL: [
                  { c: 190, t: "2025-01-14T05:00:00Z" },
                  { c: 195, t: "2025-01-15T05:00:00Z" },
                ],
              },
            },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await latestPrices(
      ["AAPL", "AAPL"],
      "alpaca",
      new Date("2025-01-16T00:00:00Z"),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result[0]).toMatchObject({
      price: "195",
      timestamp: "2025-01-15T21:00:00.000Z",
      feed: "iex",
      type: "latest-trade",
    });
    expect(result[0].history).toHaveLength(2);
    expect(fetch.mock.calls[1][0]).toContain("limit=1000");
  });
  it("enforces symbol limits before making requests", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      latestPrices(
        Array.from({ length: 13 }, (_, i) => `S${i}`),
        "alpaca",
      ),
    ).rejects.toThrow(/12 distinct/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("preserves latest prices if charts fail, and never substitutes fixture data", async () => {
    vi.stubEnv("ALPACA_API_KEY", "test-key");
    vi.stubEnv("ALPACA_API_SECRET", "test-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) =>
        input.includes("snapshots")
          ? Response.json({
              AAPL: { latestTrade: { p: 195, t: "2025-01-15T21:00:00Z" } },
            })
          : new Response(null, { status: 429 }),
      ),
    );
    const result = await latestPrices(
      ["AAPL", "MSFT"],
      "alpaca",
      new Date("2025-01-16T00:00:00Z"),
    );
    expect(result[0].price).toBe("195");
    expect(result[0].history).toEqual([]);
    expect(result[1].price).toBeNull();
    expect(result[1].provider).toBe("alpaca");
  });
});
