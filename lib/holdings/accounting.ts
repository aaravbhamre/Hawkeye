import { decimal, format, SCALE } from "@/lib/fix/decimal";
import type { Event, Report } from "@/lib/fix/types";
import type { Holding, HoldingsReport, PriceSnapshot } from "./types";

// One independent simulated book per FIX session. No account/cross-session merging.
// Cost is retained at quantity-scale * price-scale; division truncates toward zero.
export function holdings(
  report: Report,
  zeroOpeningPositions = false,
  prices: PriceSnapshot[] = [],
): HoldingsReport {
  const groups = new Map<
    string,
    { session: string; symbol: string; events: Event[]; reasons: Set<string> }
  >();
  const sources = new Map(report.sources.map((s) => [s.id, s]));
  for (const order of report.orders) {
    for (const event of order.events.filter((e) => e.execType === "F")) {
      const id = JSON.stringify([event.session, event.symbol]);
      if (!groups.has(id))
        groups.set(id, {
          session: event.session,
          symbol: event.symbol,
          events: [],
          reasons: new Set(),
        });
      const group = groups.get(id)!;
      if (order.reconciliation !== "reconciled")
        group.reasons.add("Order history is unresolved or conflicting.");
      if (
        order.events.some((e) =>
          sources
            .get(e.sourceId)
            ?.fields.some(
              (f) =>
                (f.tag === "15" && f.value !== "USD") ||
                (f.tag === "167" && f.value !== "CS") ||
                f.tag === "1",
            ),
        )
      )
        group.reasons.add(
          "Only USD common stock in a single unqualified book per session is supported; explicit account allocation is unsupported.",
        );
      if (!event.duplicateOf && !event.disputed) group.events.push(event);
    }
  }
  // An orphan/non-fill response in the same book can signal missing inventory too.
  for (const order of report.orders) {
    if (order.reconciliation === "reconciled") continue;
    for (const event of order.events) {
      groups
        .get(JSON.stringify([event.session, event.symbol]))
        ?.reasons.add("Order history is unresolved or conflicting.");
    }
  }
  const rows: Holding[] = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, group]) => {
      if (!zeroOpeningPositions)
        group.reasons.add(
          "Opening position and earlier transaction history are unknown. Confirm a complete capture with zero opening positions to calculate cost basis.",
        );
      const events = group.events.sort(
        (a, b) =>
          a.timestamp.localeCompare(b.timestamp) ||
          a.sender.localeCompare(b.sender) ||
          a.sequence - b.sequence ||
          a.sourceId.localeCompare(b.sourceId),
      );
      const times = new Map<string, Event[]>();
      for (const e of events)
        times.set(e.timestamp, [...(times.get(e.timestamp) ?? []), e]);
      for (const sameTime of times.values())
        if (
          sameTime.length > 1 &&
          (new Set(sameTime.map((e) => e.sender)).size > 1 ||
            new Set(sameTime.map((e) => e.sequence)).size !== sameTime.length)
        )
          group.reasons.add("Cross-order execution chronology is ambiguous.");
      let quantity = 0n,
        cost = 0n;
      const seen = new Set<string>();
      const ids: string[] = [];
      for (const e of events) {
        const key = JSON.stringify([e.session, e.execId]);
        if (seen.has(key)) continue;
        seen.add(key);
        ids.push(e.sourceId);
        const size = decimal(e.lastQty!),
          price = decimal(e.lastPx!);
        if (e.side === "buy") {
          quantity += size;
          cost += size * price;
        } else {
          if (size > quantity)
            group.reasons.add(
              "Sell exceeds observed inventory. Opening holdings or short-sale accounting are missing.",
            );
          if (quantity > 0n && size <= quantity)
            cost -= (cost * size) / quantity;
          quantity -= size;
        }
      }
      const complete = !group.reasons.size;
      const market = prices.find((p) => p.symbol === group.symbol) ?? null;
      const lastExecution = events.at(-1)?.timestamp ?? "";
      const priceUsable =
        !!market?.price &&
        !!market.timestamp &&
        market.timestamp >= lastExecution;
      if (market?.timestamp && market.timestamp < lastExecution)
        group.reasons.add(
          "Price predates the last observed execution; valuation is withheld.",
        );
      const value =
        complete && quantity === 0n
          ? 0n
          : complete && priceUsable
            ? (quantity * decimal(market!.price!)) / SCALE
            : null;
      const basis = complete ? cost / SCALE : null;
      const pnl = value !== null && basis !== null ? value - basis : null;
      return {
        id,
        session: group.session,
        symbol: group.symbol,
        netQuantity: format(quantity),
        averageCost: complete && quantity > 0n ? format(cost / quantity) : null,
        costBasis: basis === null ? null : format(basis),
        complete,
        reasons: [...group.reasons],
        sourceIds: ids,
        lastExecution,
        market,
        marketValue: value === null ? null : format(value),
        unrealizedPnl: pnl === null ? null : format(pnl),
        unrealizedPercent:
          pnl !== null && basis !== null && basis > 0n
            ? format((pnl * 100n * SCALE) / basis)
            : null,
      };
    });
  const complete =
    rows.length > 0 &&
    report.summary.unresolvedOrders === 0 &&
    !report.sources.some((s) => !s.valid) &&
    rows.every((h) => h.complete && h.marketValue !== null);
  const signed = (v: string) => {
    const [whole, fraction = ""] = v.replace("-", "").split(".");
    return (
      (v.startsWith("-") ? -1n : 1n) *
      (BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0")))
    );
  };
  const value = complete
    ? rows.reduce((sum, h) => sum + signed(h.marketValue!), 0n)
    : null;
  const cost = complete
    ? rows.reduce((sum, h) => sum + signed(h.costBasis!), 0n)
    : null;
  const pnl = value !== null && cost !== null ? value - cost : null;
  return {
    inputDigest: report.inputDigest,
    zeroOpeningPositions,
    method:
      "Moving weighted-average cost, long positions only; 6-decimal fixed-point quantities/prices; cost retained at 12-decimal precision, proportional sell reductions truncate toward zero. Fees, taxes, corporate actions and short positions excluded. Independent book per session; zero openings require explicit user declaration.",
    holdings: rows,
    summary: {
      complete,
      marketValue: value === null ? null : format(value),
      unrealizedPnl: pnl === null ? null : format(pnl),
      unrealizedPercent:
        pnl !== null && cost !== null && cost > 0n
          ? format((pnl * 100n * SCALE) / cost)
          : null,
    },
  };
}
