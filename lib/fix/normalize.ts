import type { Event, Source } from "./types";
import { fieldsOf, fixTime } from "./validate";
import { decimal, format } from "./decimal";
export function normalize(source: Source): Event | null {
  if (!source.valid) return null;
  const f = fieldsOf(source);
  for (const tag of ["38", "32", "31", "14", "151", "6"])
    if (f[tag] !== undefined) f[tag] = format(decimal(f[tag]));
  const timestamp = fixTime(f[60] ?? f[122] ?? f[52])!;
  return {
    sourceId: source.id,
    session: JSON.stringify([
      f[8],
      [f[49], f[56]].sort(),
      fixTime(f[122] ?? f[52])!.slice(0, 10),
    ]),
    sender: f[49],
    sequence: Number(f[34]),
    timestamp,
    type:
      f[35] === "D"
        ? "request"
        : f[35] === "F"
          ? "cancel-request"
          : "execution",
    clOrdId: f[11],
    origClOrdId: f[41],
    brokerOrderId: f[37],
    execId: f[17],
    execType: f[150],
    status: f[39],
    symbol: f[55],
    side: f[54] === "1" ? "buy" : "sell",
    quantity: f[38],
    lastQty: f[32],
    lastPx: f[31],
    cumQty: f[14],
    leavesQty: f[151],
    avgPx: f[6],
  };
}
