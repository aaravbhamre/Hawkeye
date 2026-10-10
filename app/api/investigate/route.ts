import {
  authorize,
  investigate,
  investigateSchema,
} from "@/lib/ai/investigator";
import { failure, json, readJson } from "@/lib/server/http";
export const runtime = "nodejs";
export const maxDuration = 40;
export async function POST(request: Request) {
  try {
    authorize(request);
    const input = investigateSchema.parse(await readJson(request, 120_000));
    return json(await investigate(input));
  } catch (error) {
    return failure(error);
  }
}
