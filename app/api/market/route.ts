import { analyze } from "@/lib/fix/report";
import {
  checkLines,
  failure,
  inputSchema,
  json,
  readJson,
} from "@/lib/server/http";
import { lookupComparison, marketRequestSchema } from "@/lib/market/service";
export const runtime = "nodejs";
export const maxDuration = 15;
export async function POST(request: Request) {
  try {
    const input = inputSchema
      .extend(marketRequestSchema.shape)
      .parse(await readJson(request));
    checkLines(input.text);
    return json(
      await lookupComparison(analyze(input.text, input.filename), input),
    );
  } catch (error) {
    return failure(error);
  }
}
