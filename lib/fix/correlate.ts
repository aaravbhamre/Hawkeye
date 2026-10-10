import type { Event } from "./types";
export function correlate(events: Event[]): Event[][] {
  const parent = new Map<string, string>();
  function root(key: string): string { if (!parent.has(key)) parent.set(key, key); let r = key; while (parent.get(r) !== r) r = parent.get(r)!; while (parent.get(key) !== key) { const next = parent.get(key)!; parent.set(key, r); key = next; } return r; }
  const aliases = (e: Event) => [e.clOrdId && `client:${e.clOrdId}`, e.origClOrdId && `client:${e.origClOrdId}`, e.brokerOrderId && `broker:${e.brokerOrderId}`].filter(Boolean).map(a => JSON.stringify([e.session, a]));
  for (const e of events) { const keys = aliases(e); for (const k of keys.slice(1)) { const a = root(keys[0]), b = root(k); if (a !== b) parent.set(b, a); } }
  const groups = new Map<string, Event[]>();
  for (const e of events) { const k = root(aliases(e)[0] ?? e.sourceId); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(e); }
  return [...groups.values()];
}
