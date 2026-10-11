import { z } from "zod";
import { analyze } from "@/lib/fix/report";
import { holdings } from "@/lib/holdings/accounting";
import { latestPrices } from "@/lib/market/latest";
import {
  checkLines,
  failure,
  inputSchema,
  json,
  readJson,
  ApiError,
} from "@/lib/server/http";
export const runtime = "nodejs";
export const maxDuration = 15;
const schema = inputSchema.extend({
  zeroOpeningPositions: z.boolean().default(false),
  provider: z.enum(["fixture", "alpaca"]).default("fixture"),
  refresh: z.boolean().default(false),
});
export async function POST(request: Request) {
  try {
    const input = schema.parse(await readJson(request));
    checkLines(input.text);
    const report = analyze(input.text, input.filename);
    const base = holdings(report, input.zeroOpeningPositions);
    if (!input.refresh) return json({ ...base, retrievedAt: null });
    try {
      const prices = await latestPrices(
        base.holdings.map((h) => h.symbol),
        input.provider,
      );
      return json({
        ...holdings(report, input.zeroOpeningPositions, prices),
        retrievedAt: new Date().toISOString(),
      });
    } catch (error) {
      // Preserve deterministic analysis even if the market provider fails.
      return json({
        ...base,
        retrievedAt: null,
        priceError:
          error instanceof ApiError
            ? error.message
            : "Latest prices unavailable. Holdings analysis is unchanged.",
      });
    }
  } catch (error) {
    return failure(error);
  }
}
