import "server-only";
import { z } from "zod";
import type { Report } from "@/lib/fix/types";
import { ApiError } from "@/lib/server/http";
import { alpacaProvider } from "./alpaca";
import { fixtureProvider } from "./fixture";
import { compare } from "./compare";
export const marketRequestSchema = z.object({ sourceId: z.string().max(60), provider: z.enum(["fixture", "alpaca"]) });
export async function lookupComparison(report: Report, request: z.infer<typeof marketRequestSchema>) {
  const order = report.orders.find(o => o.events.some(e => e.sourceId === request.sourceId));
  const execution = order?.events.find(e => e.sourceId === request.sourceId && e.execType === "F" && !e.duplicateOf && !e.disputed);
  if (!order || !execution) throw new ApiError(400, "Select a unique, undisputed execution from the authoritative report.");
  const fields = report.sources.find(s => s.id === execution.sourceId)!.fields;
  if (fields.some(f => (f.tag === "15" && f.value !== "USD") || (f.tag === "167" && f.value !== "CS"))) throw new ApiError(400, "Market comparisons support USD common-stock executions only.");
  try { return compare(order, execution, await (request.provider === "fixture" ? fixtureProvider : alpacaProvider).lookup({ symbol: execution.symbol, timestamp: execution.timestamp })); }
  catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(404, "No compatible historical reference is available for this execution. Analysis is unchanged."); }
}
