export type Reference = {
  provider: "fixture" | "alpaca";
  feed: string;
  symbol: string;
  timestamp: string;
  endTimestamp: string;
  price: string;
  type: "minute-bar-close";
  limitations: string[];
};
export type Lookup = { symbol: string; timestamp: string };
export interface MarketProvider {
  lookup(input: Lookup): Promise<Reference>;
}
export type Comparison = {
  sourceId: string;
  orderId: string;
  provider: "fixture" | "alpaca";
  feed: string;
  symbol: string;
  side: "buy" | "sell";
  executionTimestamp: string;
  executionPrice: string;
  referenceTimestamp: string;
  referenceEndTimestamp: string;
  referencePrice: string;
  referenceType: string;
  distanceMs: number;
  difference: string;
  adverseDifference: string;
  adverseBps: string;
  flagged: boolean;
  thresholdBps: string;
  method: string;
  limitations: string[];
};
