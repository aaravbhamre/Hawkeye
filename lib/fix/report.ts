import { correlate } from "./correlate";
import { deduplicate } from "./deduplicate";
import { decimal, format } from "./decimal";
import { normalize } from "./normalize";
import { reduceOrder } from "./reduce";
import { hash, tokenize } from "./tokenize";
import type { Report } from "./types";
import { validate } from "./validate";
export function analyze(text: string, filename = "session.fix"): Report {
  const { sources, findings } = tokenize(text, filename);
  for (const source of sources) findings.push(...validate(source));
  const events = sources.map(normalize).filter((e) => e !== null);
  const invalidSources = sources.filter((s) => !s.valid).map((s) => s.id);
  if (invalidSources.length)
    findings.push({
      code: "EXCLUDED_INPUT",
      severity: "warning",
      message:
        "Invalid or unsupported messages were excluded; completeness is unresolved for all orders in this capture.",
      sourceIds: invalidSources,
    });
  const duplicateFindings = deduplicate(events);
  findings.push(...duplicateFindings);
  const sequences = new Map<string, typeof events>();
  for (const e of events.filter((e) => !e.duplicateOf)) {
    const key = JSON.stringify([e.session, e.sender, e.sequence]);
    if (!sequences.has(key)) sequences.set(key, []);
    sequences.get(key)!.push(e);
  }
  for (const group of sequences.values())
    if (group.length > 1)
      findings.push({
        code: "SEQUENCE_REUSE",
        severity: "warning",
        message:
          "Different messages reuse a sender sequence number in the same session; reset or conflicting delivery is unresolved.",
        sourceIds: group.map((e) => e.sourceId).sort(),
      });
  const bySource = new Map<string, typeof findings>();
  for (const f of findings)
    for (const id of f.sourceIds) {
      if (!bySource.has(id)) bySource.set(id, []);
      bySource.get(id)!.push(f);
    }
  const orders = correlate(events)
    .map((group) => {
      const inherited = new Set(
        group.flatMap((e) => bySource.get(e.sourceId) ?? []),
      );
      // Invalid records may contain untrustworthy correlation keys: conservatively mark every order in this capture unresolved.
      if (invalidSources.length)
        inherited.add({
          code: "EXCLUDED_INPUT",
          severity: "warning",
          message:
            "Completeness is unresolved; see the capture-level EXCLUDED_INPUT evidence.",
          sourceIds: [],
        });
      return reduceOrder(group, [...inherited]);
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const findingKeys = new Set(
    findings.map((f) => JSON.stringify([f.code, f.sourceIds])),
  );
  const allFindings = [
    ...findings,
    ...orders.flatMap((o) =>
      o.findings.filter(
        (f) => !findingKeys.has(JSON.stringify([f.code, f.sourceIds])),
      ),
    ),
  ];
  return {
    schemaVersion: "1.0",
    inputDigest: hash(JSON.stringify({ text, filename })),
    policy: {
      protocol: "FIX 4.4: D, 8 (ExecType 0/F/4/8), F; buy/sell only",
      wireValidation:
        "BodyLength and CheckSum NOT validated. Pipe input is a demo representation, never wire-valid.",
      arithmetic:
        "Fixed-point BigInt, 6 fractional digits; output decimals truncate toward zero.",
      ordering:
        "UTC TransactTime, else OrigSendingTime, else SendingTime; equal timestamps use sequence only within one sender; unresolved ties use sender and source ID for display.",
    },
    summary: {
      messages: sources.length,
      orders: orders.length,
      uniqueFills: events.filter(
        (e) => e.execType === "F" && !e.duplicateOf && !e.disputed,
      ).length,
      duplicateDeliveries: events.filter((e) => e.duplicateOf).length,
      unresolvedOrders: orders.filter((o) => o.reconciliation === "unresolved")
        .length,
      observedFilledQty: format(
        events
          .filter((e) => e.execType === "F" && !e.duplicateOf && !e.disputed)
          .reduce((n, e) => n + decimal(e.lastQty!), 0n),
      ),
    },
    orders,
    findings: allFindings,
    sources,
  };
}
