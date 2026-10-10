import { lifecycle } from "../lib/fixtures";
export function workload(orders: number, seed = 2025) {
  const lines: string[] = [];
  let state = seed >>> 0,
    duplicates = 0;
  const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
  for (let i = 0; i < orders; i++) {
    const events = lifecycle(
      `BENCH-${i}`,
      i % 2 ? "CLIENT-A" : "CLIENT-B",
      i % 2 ? "AAPL" : "MSFT",
      i % 2 ? "1" : "2",
      "100",
      "40",
      "190",
      "191",
      "190.6",
      i * 3 + 1,
    );
    lines.push(...events);
    if (i % 10 === 0) {
      lines.push(events[2 + (next() % 2)]);
      duplicates++;
    }
  }
  for (let i = lines.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [lines[i], lines[j]] = [lines[j], lines[i]];
  }
  return {
    text: lines.join("\n"),
    expected: {
      orders,
      messages: lines.length,
      fills: orders * 2,
      quantity: String(orders * 100),
      duplicates,
    },
    seed,
  };
}
