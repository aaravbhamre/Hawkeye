import { analyze } from "@/lib/fix/report";
import {
  checkLines,
  failure,
  inputSchema,
  json,
  readJson,
} from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await readJson(request));
    checkLines(input.text);
    return json(analyze(input.text, input.filename));
  } catch (error) {
    return failure(error);
  }
}
