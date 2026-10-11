export type PricePoint = { timestamp: string; price: string };
export type PriceSnapshot = {
  symbol: string;
  price: string | null;
  timestamp: string | null;
  provider: "fixture" | "alpaca";
  feed: string;
  type: "synthetic-close" | "latest-trade";
  history: PricePoint[];
  limitations: string[];
  error?: string;
};
export type Holding = {
  id: string;
  session: string;
  symbol: string;
  netQuantity: string;
  averageCost: string | null;
  costBasis: string | null;
  complete: boolean;
  reasons: string[];
  sourceIds: string[];
  lastExecution: string;
  market: PriceSnapshot | null;
  marketValue: string | null;
  unrealizedPnl: string | null;
  unrealizedPercent: string | null;
};
export type HoldingsReport = {
  inputDigest: string;
  zeroOpeningPositions: boolean;
  method: string;
  holdings: Holding[];
  summary: {
    complete: boolean;
    marketValue: string | null;
    unrealizedPnl: string | null;
    unrealizedPercent: string | null;
  };
};
export type HoldingsResponse = HoldingsReport & {
  retrievedAt: string | null;
  priceError?: string;
};
