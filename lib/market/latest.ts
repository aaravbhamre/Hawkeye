import "server-only";
import { z } from "zod";
import { decimal } from "@/lib/fix/decimal";
import type { PriceSnapshot } from "@/lib/holdings/types";
import { ApiError } from "@/lib/server/http";

const timestamp = z.string().datetime({ offset: true });
const price = z
  .number()
  .positive()
  .finite()
  .refine((value) => {
    try {
      decimal(String(value));
      return true;
    } catch {
      return false;
    }
  });
const trade = z.object({ p: price, t: timestamp });
const bar = z.object({ c: price, t: timestamp });
const snapshotsSchema = z.record(
  z.string(),
  z.object({ latestTrade: trade.nullable().optional() }),
);
const historySchema = z.object({
  bars: z.record(z.string(), z.array(bar).nullable()),
  next_page_token: z.string().nullable().optional(),
});
const synthetic: Record<string, string[]> = {
  AAPL: [
    "186",
    "188.5",
    "187.2",
    "189",
    "190.25",
    "188.75",
    "192",
    "191.5",
    "194",
    "195",
  ],
  MSFT: [
    "422",
    "420",
    "424",
    "421",
    "419.8",
    "417",
    "419",
    "416",
    "417.5",
    "415",
  ],
};
export async function latestPrices(
  symbols: string[],
  provider: "fixture" | "alpaca",
  now = new Date(),
): Promise<PriceSnapshot[]> {
  const unique = [...new Set(symbols)].sort();
  if (unique.length > 12)
    throw new ApiError(
      400,
      "Price refresh supports at most 12 distinct symbols per capture.",
    );
  if (!unique.length) return [];
  if (unique.some((s) => !/^[A-Z][A-Z0-9.-]{0,14}$/.test(s)))
    throw new ApiError(400, "Unsupported US equity symbol format.");
  if (provider === "fixture")
    return unique.map((symbol) => {
      const history = (synthetic[symbol] ?? []).map((price, index) => ({
        price,
        timestamp: new Date(Date.UTC(2025, 0, 6 + index, 21)).toISOString(),
      }));
      return {
        symbol,
        provider,
        feed: "synthetic-demo",
        type: "synthetic-close",
        price: history.at(-1)?.price ?? null,
        timestamp: history.at(-1)?.timestamp ?? null,
        history,
        limitations: [
          "Synthetic demonstration prices from January 2025. Not live or real market data.",
          "Unadjusted daily illustrative closes; no dividends, splits or fees.",
        ],
        ...(!history.length
          ? { error: "No synthetic price history exists for this symbol." }
          : {}),
      };
    });
  const key = process.env.ALPACA_API_KEY,
    secret = process.env.ALPACA_API_SECRET;
  if (!key || !secret)
    throw new ApiError(
      503,
      "Alpaca credentials are not configured. Holdings analysis is available; no fixture prices were substituted.",
    );
  const headers = { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret };
  const signal = AbortSignal.timeout(8000);
  async function get(path: string) {
    let response: Response;
    try {
      response = await fetch(`https://data.alpaca.markets/v2/stocks/${path}`, {
        headers,
        signal,
        cache: "no-store",
      });
    } catch {
      throw new ApiError(
        504,
        "Alpaca price refresh timed out or could not connect.",
      );
    }
    if (response.status === 429)
      throw new ApiError(429, "Alpaca rate limit reached. Retry later.");
    if ([401, 403].includes(response.status))
      throw new ApiError(
        503,
        "Alpaca credentials or IEX feed access were denied.",
      );
    if (!response.ok)
      throw new ApiError(502, "Alpaca latest-price data is unavailable.");
    try {
      return await response.json();
    } catch {
      throw new ApiError(502, "Alpaca returned invalid price data.");
    }
  }
  const q = new URLSearchParams({ symbols: unique.join(","), feed: "iex" });
  const h = new URLSearchParams({
    symbols: unique.join(","),
    feed: "iex",
    timeframe: "1Day",
    adjustment: "raw",
    sort: "asc",
    limit: "1000",
    start: new Date(now.getTime() - 45 * 86400000).toISOString(),
    end: new Date(now.getTime() - 15 * 60000).toISOString(),
  });
  // Two bounded, batched requests. Historical execution comparison uses a separate adapter.
  const [latest, historyResult] = await Promise.allSettled([
    get(`snapshots?${q}`),
    get(`bars?${h}`),
  ]);
  if (latest.status === "rejected") throw latest.reason;
  const parsed = snapshotsSchema.safeParse(latest.value);
  if (!parsed.success)
    throw new ApiError(
      502,
      "Alpaca returned an unsupported snapshot response.",
    );
  const history =
    historyResult.status === "fulfilled"
      ? historySchema.safeParse(historyResult.value)
      : null;
  return unique.map((symbol) => {
    const candidate = parsed.data[symbol]?.latestTrade;
    const last =
      candidate && Date.parse(candidate.t) <= now.getTime() ? candidate : null;
    const bars = history?.success ? (history.data.bars[symbol] ?? []) : [];
    return {
      symbol,
      provider,
      feed: "iex",
      type: "latest-trade",
      price: last ? String(last.p) : null,
      timestamp: last ? new Date(last.t).toISOString() : null,
      history: bars
        .filter((b) => Date.parse(b.t) <= now.getTime())
        .sort((a, b) => a.t.localeCompare(b.t))
        .slice(-45)
        .map((b) => ({
          timestamp: new Date(b.t).toISOString(),
          price: String(b.c),
        })),
      limitations: [
        "External Alpaca IEX: a single exchange, not consolidated US market coverage.",
        "Latest available trade at the displayed timestamp; may be delayed or stale, especially outside market hours. Not a live stream.",
        "Chart: up to 45 calendar days of unadjusted daily bars; the most recent daily bar may be partial. No corporate-action or dividend adjustment.",
        ...(!history?.success
          ? ["Chart history unavailable; latest trade lookup is independent."]
          : history.data.next_page_token
            ? ["Chart history truncated at the bounded response limit."]
            : []),
      ],
      ...(!last
        ? { error: "No valid latest IEX trade was returned for this symbol." }
        : {}),
    };
  });
}
