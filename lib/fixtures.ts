import { decimal, format } from "./fix/decimal";
// Synthetic messages and prices, authored for this application; no real orders or proprietary logs.
const header = (
  type: string,
  seq: number,
  time: string,
  client = "DEMO",
  outbound = false,
) =>
  `8=FIX.4.4|35=${type}|49=${outbound ? client : "VENUE"}|56=${outbound ? "VENUE" : client}|34=${seq}|52=20250115-${time}|`;
export function lifecycle(
  id = "ORD-1001",
  client = "DEMO",
  symbol = "AAPL",
  side = "1",
  qty = "100",
  first = "40",
  price1 = "190",
  price2 = "191",
  avg = "190.6",
  seq = 1,
): string[] {
  return [
    header("D", seq, "15:30:00.000", client, true) +
      `11=${id}|55=${symbol}|54=${side}|38=${qty}|40=1|60=20250115-15:30:00.000|`,
    header("8", seq, "15:30:00.020", client) +
      `11=${id}|37=B-${id}|17=${id}-ACK|150=0|39=0|55=${symbol}|54=${side}|38=${qty}|14=0|151=${qty}|6=0|60=20250115-15:30:00.020|`,
    header("8", seq + 1, "15:31:10.000", client) +
      `11=${id}|37=B-${id}|17=${id}-F1|150=F|39=1|55=${symbol}|54=${side}|38=${qty}|32=${first}|31=${price1}|14=${first}|151=${format(decimal(qty) - decimal(first))}|6=${price1}|60=20250115-15:31:10.000|`,
    header("8", seq + 2, "15:32:10.000", client) +
      `11=${id}|37=B-${id}|17=${id}-F2|150=F|39=2|55=${symbol}|54=${side}|38=${qty}|32=${format(decimal(qty) - decimal(first))}|31=${price2}|14=${qty}|151=0|6=${avg}|60=20250115-15:32:10.000|`,
  ];
}
export type Fault = "duplicate" | "missing-ack" | "shuffle";
export function injectFault(text: string, fault: Fault): string {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (fault === "duplicate") {
    const fill = lines.find((l) => /(?:\||\x01)150=F(?:\||\x01)/.test(l));
    return fill ? [...lines, fill].join("\n") : text;
  }
  if (fault === "missing-ack")
    return lines
      .filter((l) => !/(?:\||\x01)150=0(?:\||\x01)/.test(l))
      .join("\n");
  // Deterministic Fisher-Yates shuffle, independent of event chronology.
  let seed = 42;
  for (let i = lines.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [lines[i], lines[j]] = [lines[j], lines[i]];
  }
  return lines.join("\n");
}
const aapl = lifecycle();
const clean = [
  ...aapl,
  ...lifecycle(
    "ORD-1002",
    "DEMO",
    "MSFT",
    "2",
    "50",
    "20",
    "420",
    "419",
    "419.4",
    10,
  ),
].join("\n");
const cancel = [
  aapl[0],
  aapl[1],
  aapl[2],
  header("F", 2, "15:31:20.000", "DEMO", true) +
    "11=CANCEL-1|41=ORD-1001|37=B-ORD-1001|55=AAPL|54=1|38=100|60=20250115-15:31:20.000|",
  header("8", 3, "15:31:20.030") +
    "11=CANCEL-1|41=ORD-1001|37=B-ORD-1001|17=ORD-1001-CANCEL|150=4|39=4|55=AAPL|54=1|38=100|14=40|151=0|6=190|60=20250115-15:31:20.030|",
].join("\n");
export const samples = [
  {
    id: "clean",
    name: "Clean session · AAPL + MSFT",
    text: clean,
    expected:
      "2 reconciled orders; 150 observed shares; 4 distinct fills. AAPL 100 @ 190.6; MSFT 50 @ 419.4.",
  },
  {
    id: "duplicate",
    name: "Duplicate execution",
    text: injectFault(clean, "duplicate"),
    expected: "150 observed shares; one duplicate delivery excluded.",
  },
  {
    id: "missing-ack",
    name: "Missing acknowledgment",
    text: injectFault(clean, "missing-ack"),
    expected: "150 observed shares; both orders unresolved.",
  },
  {
    id: "missing-request",
    name: "Orphan execution reports",
    text: aapl.slice(1).join("\n"),
    expected:
      "100 observed shares; missing request; reconciliation unresolved.",
  },
  {
    id: "conflict",
    name: "Conflicting cumulative quantity",
    text: aapl.join("\n").replace("14=100|", "14=110|"),
    expected: "100 observed shares; reported 110; explicit conflict.",
  },
  {
    id: "sessions",
    name: "Two sessions · same order IDs",
    text: [...aapl, ...lifecycle("ORD-1001", "SECOND")].join("\n"),
    expected: "Two independent orders of 100 shares each; no duplicates.",
  },
  {
    id: "cancel",
    name: "Request then confirmed cancellation",
    text: cancel,
    expected:
      "40 observed shares; canceled only after the confirmation; 0 reported leaves.",
  },
  {
    id: "holdings",
    name: "Holdings demo · buys + partial sale",
    text: [
      ...lifecycle(),
      ...lifecycle(
        "ORD-1002",
        "DEMO",
        "MSFT",
        "1",
        "50",
        "20",
        "420",
        "419",
        "419.4",
        10,
      ),
      ...lifecycle(
        "SELL-1003",
        "DEMO",
        "AAPL",
        "2",
        "25",
        "10",
        "200",
        "200",
        "200",
        20,
      ).map((line) =>
        line
          .replaceAll("15:30", "15:33")
          .replaceAll("15:31", "15:34")
          .replaceAll("15:32", "15:35"),
      ),
    ].join("\n"),
    expected:
      "175 observed executed shares. With declared zero openings: AAPL 75 @ 190.6; MSFT 50 @ 419.4. Fixture valuation $35,375; unrealized gain $110.",
  },
];
