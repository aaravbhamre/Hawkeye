import { decimal } from "./decimal";
import { GROUP_TAGS } from "./group-tags";
import type { Finding, Source } from "./types";
export const fieldsOf = (source: Source): Record<string, string> =>
  Object.fromEntries(source.fields.map(({ tag, value }) => [tag, value]));
export function fixTime(value?: string): string | null {
  const match =
    value &&
    /^(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(
      value,
    );
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.${(match[7] ?? "").padEnd(3, "0")}Z`;
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) && date.toISOString() === iso
    ? iso
    : null;
}
const supported = new Set(
  "8 9 10 35 49 56 34 52 43 122 11 41 37 17 150 39 55 54 38 40 44 59 60 32 31 14 151 6 58".split(
    " ",
  ),
);
export function validate(source: Source): Finding[] {
  const findings: Finding[] = [];
  const fail = (code: string, message: string) => {
    source.valid = false;
    findings.push({ code, severity: "error", message, sourceIds: [source.id] });
  };
  const seen = new Set<string>();
  for (const field of source.fields) {
    if (seen.has(field.tag))
      fail(
        "DUPLICATE_TAG",
        `Duplicate tag ${field.tag} is preserved but cannot be interpreted unambiguously.`,
      );
    seen.add(field.tag);
    if (GROUP_TAGS.has(field.tag))
      fail(
        "UNSUPPORTED_GROUP",
        `Repeating group count tag ${field.tag} is unsupported.`,
      );
    else if (!supported.has(field.tag))
      findings.push({
        code: "UNKNOWN_TAG",
        severity: "warning",
        message: `Tag ${field.tag} is preserved but not interpreted.`,
        sourceIds: [source.id],
      });
  }
  const f = fieldsOf(source);
  const required = ["8", "35", "49", "56", "34", "52"];
  if (f[35] === "D") required.push("11", "55", "54", "38", "40");
  else if (f[35] === "8")
    required.push("37", "17", "150", "39", "55", "54", "14", "151", "6");
  else if (f[35] === "F") required.push("11", "41", "55", "54", "38");
  else
    fail(
      "UNSUPPORTED_MESSAGE",
      `Message type ${f[35] ?? "missing"} is outside the supported D / 8 / F subset.`,
    );
  for (const tag of required)
    if (!f[tag])
      fail("MISSING_FIELD", `Required supported field ${tag} is missing.`);
  if (f[8] !== "FIX.4.4")
    fail("UNSUPPORTED_VERSION", "Only FIX.4.4 is supported.");
  if (!/^[1-9]\d{0,8}$/.test(f[34] ?? ""))
    fail(
      "INVALID_SEQUENCE",
      "MsgSeqNum must be a positive integer of at most 9 digits.",
    );
  if (
    !fixTime(f[52]) ||
    (f[60] !== undefined && !fixTime(f[60])) ||
    (f[122] !== undefined && !fixTime(f[122]))
  )
    fail(
      "INVALID_TIMESTAMP",
      "Timestamps must be valid UTC FIX timestamps with up to millisecond precision.",
    );
  if (f[54] !== "1" && f[54] !== "2")
    fail("UNSUPPORTED_SIDE", "Only Buy (1) and Sell (2) are supported.");
  if (f[35] === "D" && !["1", "2"].includes(f[40]))
    fail(
      "UNSUPPORTED_ORDER_TYPE",
      "Only market (1) and limit (2) orders are supported.",
    );
  if (f[40] === "2" && !f[44])
    fail("MISSING_PRICE", "Limit orders require Price (44).");
  if (f[150] && !["0", "F", "4", "8"].includes(f[150]))
    fail(
      "UNSUPPORTED_EXEC_TYPE",
      "Only New (0), Trade (F), Canceled (4), and Rejected (8) ExecType values are supported; corrections and busts are not applied.",
    );
  if (f[39] && !["0", "1", "2", "4", "8"].includes(f[39]))
    fail("UNSUPPORTED_STATUS", "Unsupported OrdStatus.");
  const statuses: Record<string, string[]> = {
    "0": ["0"],
    F: ["1", "2"],
    "4": ["4"],
    "8": ["8"],
  };
  if (f[150] && statuses[f[150]] && !statuses[f[150]].includes(f[39]))
    fail(
      "CONFLICTING_STATUS",
      "ExecType and OrdStatus are inconsistent for the supported subset.",
    );
  if (f[150] === "F")
    for (const tag of ["32", "31"])
      if (!f[tag]) fail("MISSING_FILL_FIELD", `Trade requires tag ${tag}.`);
  for (const tag of ["38", "44", "32", "31", "14", "151", "6"]) {
    if (f[tag] !== undefined) {
      const positive =
        ["38", "44"].includes(tag) ||
        (["32", "31"].includes(tag) && f[150] === "F");
      try {
        const n = decimal(f[tag]);
        if (positive && n === 0n) throw new Error();
      } catch {
        fail(
          "INVALID_DECIMAL",
          `Tag ${tag} must be a supported ${positive ? "positive" : "nonnegative"} decimal (12 integer / 6 fractional digits).`,
        );
      }
    }
  }
  if (f[43] && !["Y", "N"].includes(f[43]))
    fail("INVALID_POSS_DUP", "PossDupFlag must be Y or N.");
  if (f[43] === "Y" && !f[122])
    fail(
      "MISSING_ORIGINAL_TIME",
      "PossDupFlag=Y requires OrigSendingTime (122).",
    );
  if (
    ["50", "57", "142", "143", "141", "20"].some((tag) => f[tag] !== undefined)
  )
    fail(
      "UNSUPPORTED_SESSION_FEATURE",
      "Sub-session identifiers, resets, and legacy ExecTransType are unsupported; separate the capture before analysis.",
    );
  return findings;
}
