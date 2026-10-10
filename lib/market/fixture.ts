import type { MarketProvider } from "./types";
const prices: Record<string, Record<string, string>> = {
  AAPL: {
    "2025-01-15T15:30:00.000Z": "190",
    "2025-01-15T15:31:00.000Z": "190.25",
  },
  MSFT: {
    "2025-01-15T15:30:00.000Z": "419.5",
    "2025-01-15T15:31:00.000Z": "419.8",
  },
};
export const fixtureProvider: MarketProvider = {
  async lookup({ symbol, timestamp }) {
    const time = Date.parse(timestamp);
    const match = Object.entries(prices[symbol] ?? {})
      .filter(
        ([t]) =>
          Date.parse(t) + 60_000 <= time &&
          time - Date.parse(t) - 60_000 <= 300_000,
      )
      .sort(([a], [b]) => b.localeCompare(a))[0];
    if (!match)
      throw new Error(
        "No synthetic fixture bar exists within five minutes before this execution.",
      );
    return {
      provider: "fixture",
      feed: "synthetic-demo",
      symbol,
      timestamp: match[0],
      endTimestamp: new Date(Date.parse(match[0]) + 60_000).toISOString(),
      price: match[1],
      type: "minute-bar-close",
      limitations: [
        "Synthetic fixture prices, not real historical market data.",
        "A completed minute-bar close is approximate context, not a contemporaneous quote.",
        "Differences are review signals, not proof of poor execution or wrongdoing.",
      ],
    };
  },
};
