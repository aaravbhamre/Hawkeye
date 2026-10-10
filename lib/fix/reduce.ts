import { average, decimal, format } from "./decimal";
import { hash } from "./tokenize";
import type { Event, Finding, Order } from "./types";
export function reduceOrder(input: Event[], inherited: Finding[]): Order {
  const events = [...input].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.sender.localeCompare(b.sender) || a.sequence - b.sequence || a.sourceId.localeCompare(b.sourceId));
  const active = events.filter(e => !e.duplicateOf && !e.disputed);
  const request = active.find(e => e.type === "request");
  const identity = [...new Set(events.flatMap(e => [e.clOrdId, e.brokerOrderId].filter(Boolean)))].sort();
  const id = `o-${hash(JSON.stringify([events[0].session, identity])).slice(0, 16)}`;
  const findings: Finding[] = inherited.map(f => ({ ...f, orderId: id }));
  const add = (code: string, message: string, es: Event[], severity: Finding["severity"] = "error") => findings.push({ code, severity, message, sourceIds: es.map(e => e.sourceId), orderId: id });
  if (!request) add("MISSING_REQUEST", "No supported New Order Single is present; reported cumulative quantities remain evidence, not reconstructed fills.", events, "warning");
  if (!active.some(e => e.execType === "0" || e.execType === "8")) add("MISSING_ACK", "No supported new acknowledgment or rejection is present; history is incomplete.", events, "warning");
  if (active.filter(e => e.type === "request").length > 1) add("MULTIPLE_REQUESTS", "Multiple requests share this order identity; reuse or retransmission requires investigation.", active.filter(e => e.type === "request"));
  if (request && active.some(e => e.type === "execution" && e.timestamp < request.timestamp)) add("RESPONSE_BEFORE_REQUEST", "An execution report predates its request; clocks or correlation require investigation.", events);
  const cancel = active.filter(e => e.type === "cancel-request").at(-1);
  if (cancel && !active.some(e => e.execType === "4" && e.timestamp >= cancel.timestamp)) add("CANCEL_PENDING", "A cancel request has no supported cancellation confirmation. It does not establish a canceled order.", [cancel], "warning");
  if (new Set(events.map(e => `${e.symbol}/${e.side}`)).size > 1) add("CONFLICTING_IDENTITY", "Correlated messages disagree on symbol or side.", events);
  if (new Set(events.map(e => e.brokerOrderId).filter(Boolean)).size > 1) add("CONFLICTING_ORDER_IDS", "A client identity maps to multiple broker OrderIDs.", events);
  const times = new Map<string, Event[]>();
  for (const e of active) { if (!times.has(e.timestamp)) times.set(e.timestamp, []); times.get(e.timestamp)!.push(e); }
  for (const group of times.values()) if (group.length > 1 && (new Set(group.map(e => e.sender)).size > 1 || new Set(group.map(e => e.sequence)).size !== group.length)) add("AMBIGUOUS_ORDERING", "Equal timestamps lack a comparable, unique sender sequence. Display tie-breaking is deterministic but chronology is unresolved.", group);
  let qty = 0n, notional = 0n;
  let reported: Event | undefined;
  let status = "Pending acknowledgment";
  let terminal = false;
  const requested = request?.quantity ? decimal(request.quantity) : null;
  for (const e of active) {
    if (e.quantity && requested !== null && decimal(e.quantity) !== requested) add("CONFLICTING_ORDER_QTY", "OrderQty disagrees with the request.", [request!, e]);
    if (e.type !== "execution") continue;
    if (terminal) add("EVENT_AFTER_TERMINAL", "An execution report follows a filled, canceled, or rejected state.", [e]);
    if (e.execType === "F") { qty += decimal(e.lastQty!); notional += decimal(e.lastQty!) * decimal(e.lastPx!); }
    if (decimal(e.cumQty!) !== qty) add("CUM_QTY_MISMATCH", `Reported CumQty ${e.cumQty} differs from observed unique fills ${format(qty)}.`, [e]);
    if (requested !== null && qty > requested) add("OVERFILL", "Observed unique fills exceed requested quantity.", [e]);
    if (requested !== null && ["0", "1", "2"].includes(e.status!) && decimal(e.leavesQty!) !== requested - qty) add("LEAVES_QTY_MISMATCH", "Reported LeavesQty does not equal OrderQty minus observed fills.", [e]);
    if (["2", "4", "8"].includes(e.status!) && decimal(e.leavesQty!) !== 0n) add("TERMINAL_LEAVES", "A terminal report has nonzero LeavesQty.", [e]);
    if (e.status === "2" && requested !== null && qty !== requested) add("FILLED_QTY_MISMATCH", "Filled status does not reconcile with OrderQty.", [e]);
    if (e.status === "1" && (qty === 0n || (requested !== null && qty >= requested))) add("PARTIAL_STATUS_MISMATCH", "Partially filled status conflicts with observed quantities.", [e]);
    if (["0", "8"].includes(e.status!) && qty !== 0n) add("STATUS_QTY_MISMATCH", "New or rejected status is inconsistent with previously observed fills.", [e]);
    const expectedAvg = qty ? notional / qty : 0n;
    const avgDifference = decimal(e.avgPx!) - expectedAvg;
    if (avgDifference > 1n || avgDifference < -1n) add("AVG_PX_MISMATCH", "Reported AvgPx disagrees with observed quantity-weighted execution prices (one millionth tolerance).", [e]);
    reported = e;
    status = ({ "0": "New", "1": "Partially filled", "2": "Filled", "4": "Canceled", "8": "Rejected" } as Record<string, string>)[e.status!] ?? "Unknown";
    terminal = ["2", "4", "8"].includes(e.status!);
  }
  const unresolved = findings.some(f => !["DUPLICATE_EXECUTION", "UNKNOWN_TAG"].includes(f.code));
  return { id, session: events[0].session, label: request?.clOrdId ?? identity[0] ?? "Orphan", symbol: events[0].symbol, side: events[0].side, status: unresolved ? `${status} · unresolved` : status, requestedQty: requested === null ? null : format(requested), filledQty: format(qty), averagePrice: average(notional, qty), reportedCumQty: reported?.cumQty ?? null, reportedLeavesQty: reported?.leavesQty ?? null, reconciliation: unresolved ? "unresolved" : "reconciled", events, findings };
}
