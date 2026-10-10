import { createHash } from "node:crypto";
import type { Finding, Source } from "./types";
export const hash = (text: string) =>
  createHash("sha256").update(text).digest("hex");
export function tokenize(
  text: string,
  filename = "session.fix",
): { sources: Source[]; findings: Finding[] } {
  const occurrences = new Map<string, number>();
  const findings: Finding[] = [];
  const sources: Source[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    if (!raw.trim()) return;
    const digest = hash(raw).slice(0, 16);
    const occurrence = (occurrences.get(digest) ?? 0) + 1;
    occurrences.set(digest, occurrence);
    const source: Source = {
      id: `m-${digest}-${occurrence}`,
      filename,
      line: index + 1,
      raw,
      delimiter: raw.includes("\x01") ? "SOH" : "pipe-demo",
      fields: [],
      valid: true,
    };
    const tokens = raw.split(source.delimiter === "SOH" ? "\x01" : "|");
    if (tokens.at(-1) === "") tokens.pop();
    for (const token of tokens) {
      const match = /^(\d+)=([^\x01|]*)$/.exec(token);
      if (!match) {
        source.valid = false;
        findings.push({
          code: "MALFORMED_FIELD",
          severity: "error",
          message: "A field is not tag=value, or delimiters are mixed.",
          sourceIds: [source.id],
        });
      } else source.fields.push({ tag: match[1], value: match[2] });
    }
    sources.push(source);
  });
  return { sources, findings };
}
