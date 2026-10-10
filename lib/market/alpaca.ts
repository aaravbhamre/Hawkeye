import "server-only";
import { z } from "zod";
import type { MarketProvider } from "./types";
import { ApiError } from "@/lib/server/http";
const barsSchema = z.object({ bars: z.record(z.string(), z.array(z.object({ t: z.string().datetime({ offset: true }), c: z.number().finite().positive() })).nullable()) });
export const alpacaProvider: MarketProvider = {
  async lookup({ symbol, timestamp }) {
    const key = process.env.ALPACA_API_KEY, secret = process.env.ALPACA_API_SECRET;
    if (!key || !secret) throw new ApiError(503, "Alpaca is unavailable: configure server-side ALPACA_API_KEY and ALPACA_API_SECRET, or select the labeled fixture source.");
    if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) throw new ApiError(400, "Symbol is outside the supported US equity symbol format.");
    const time = Date.parse(timestamp), minute = Math.floor(time / 60_000) * 60_000;
    const query = new URLSearchParams({ symbols: symbol, timeframe: "1Min", feed: "iex", adjustment: "raw", start: new Date(minute - 360_000).toISOString(), end: new Date(minute - 1).toISOString(), limit: "6", sort: "desc" });
    let response: Response;
    try { response = await fetch(`https://data.alpaca.markets/v2/stocks/bars?${query}`, { headers: { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret }, signal: AbortSignal.timeout(8000), cache: "no-store" }); }
    catch { throw new ApiError(504, "Alpaca historical lookup timed out or could not connect. Analysis remains available."); }
    if (response.status === 429) throw new ApiError(429, "Alpaca rate limit reached. Retry later; no fixture fallback was substituted.");
    if ([401, 403].includes(response.status)) throw new ApiError(503, "Alpaca authentication or IEX feed access was denied. Check the server credentials and data entitlement.");
    if (!response.ok) throw new ApiError(502, "Alpaca historical data is unavailable. No latest-price substitution or automatic fallback was used.");
    const parsed = barsSchema.safeParse(await response.json());
    if (!parsed.success) throw new ApiError(502, "Alpaca returned an unsupported historical-data response.");
    const bar = (parsed.data.bars[symbol] ?? []).filter(b => Date.parse(b.t) + 60_000 <= time && time - Date.parse(b.t) - 60_000 <= 300_000).sort((a, b) => b.t.localeCompare(a.t))[0];
    if (!bar) throw new ApiError(404, "No completed IEX minute bar within five minutes. The market may be closed or this feed may have no trades.");
    return { provider: "alpaca", feed: "iex", symbol, timestamp: new Date(bar.t).toISOString(), endTimestamp: new Date(Date.parse(bar.t) + 60_000).toISOString(), price: String(bar.c), type: "minute-bar-close", limitations: ["External Alpaca IEX data covers one exchange, not the full US market or NBBO.", "Completed minute-bar close; approximate historical context, unadjusted prices, not a contemporaneous quote.", "Review signal only: fees, spread, venue, and routing context are not included."] };
  },
};
