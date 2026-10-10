import { expect, it } from "vitest";
import { workload } from "@/scripts/workload";
import { analyze } from "@/lib/fix/report";
it("seeded workload has independently known totals and repeatable input", () => { const data = workload(20, 2025); expect(workload(20, 2025).text).toBe(data.text); const report = analyze(data.text); expect(report.summary).toEqual({ messages: 82, orders: 20, uniqueFills: 40, duplicateDeliveries: 2, unresolvedOrders: 0, observedFilledQty: "2000" }); });
