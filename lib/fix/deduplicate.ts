import type { Event, Finding } from "./types";
export function deduplicate(events: Event[]): Finding[] {
  const findings: Finding[] = [];
  const groups = new Map<string, Event[]>();
  for (const e of events.filter(e => e.type === "execution")) {
    const key = JSON.stringify([e.session, e.execId]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const signature = (e: Event) => JSON.stringify([e.clOrdId, e.brokerOrderId, e.execType, e.status, e.symbol, e.side, e.quantity, e.lastQty, e.lastPx, e.cumQty, e.leavesQty, e.avgPx, e.timestamp]);
    if (new Set(group.map(signature)).size > 1) {
      for (const e of group) e.disputed = true;
      findings.push({ code: "CONFLICTING_EXECUTION", severity: "error", message: "An ExecID has conflicting business fields in this session. All versions are excluded from the observed-fill total pending investigation.", sourceIds: group.map(e => e.sourceId).sort() });
    } else {
      group.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
      for (const e of group.slice(1)) e.duplicateOf = group[0].sourceId;
      findings.push({ code: "DUPLICATE_EXECUTION", severity: "warning", message: `${group.length - 1} repeated execution report delivery(s) excluded from lifecycle reduction.`, sourceIds: group.map(e => e.sourceId) });
    }
  }
  return findings;
}
