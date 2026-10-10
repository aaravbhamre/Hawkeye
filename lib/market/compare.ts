import { decimal, format, SCALE } from "@/lib/fix/decimal";
import type { Event, Order } from "@/lib/fix/types";
import type { Comparison, Reference } from "./types";
export function compare(order: Order, execution: Event, reference: Reference): Comparison {
  const executionTime = Date.parse(execution.timestamp), start = Date.parse(reference.timestamp), end = Date.parse(reference.endTimestamp);
  if (reference.symbol !== execution.symbol || !Number.isFinite(start) || !Number.isFinite(end) || end !== start + 60_000 || start % 60_000 !== 0 || end > executionTime || executionTime - end > 300_000) throw new Error("Historical reference is mismatched, future, incomplete, or more than five minutes old.");
  const price = decimal(reference.price), fillPrice = decimal(execution.lastPx!);
  if (price <= 0n) throw new Error("Reference price must be positive.");
  const difference = fillPrice - price;
  const adverse = execution.side === "buy" ? difference : -difference;
  const bps = adverse * 10_000n * SCALE / price;
  return { sourceId: execution.sourceId, orderId: order.id, provider: reference.provider, feed: reference.feed, symbol: execution.symbol, side: execution.side, executionTimestamp: execution.timestamp, executionPrice: execution.lastPx!, referenceTimestamp: reference.timestamp, referenceEndTimestamp: reference.endTimestamp, referencePrice: reference.price, referenceType: reference.type, distanceMs: executionTime - end, difference: format(difference), adverseDifference: format(adverse), adverseBps: format(bps), thresholdBps: "25", flagged: bps > 25n * SCALE, method: "(execution − reference) × side sign / reference × 10,000; buy +1, sell −1; truncate to 6 decimals", limitations: reference.limitations };
}
