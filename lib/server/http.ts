import "server-only";
import { z } from "zod";
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export const inputSchema = z.object({ text: z.string().min(1).max(500_000).refine(text => text.trim().length > 0, "Input must contain a message."), filename: z.string().max(120).regex(/^[\w. ()-]+$/).default("session.fix") });
export async function readJson(request: Request, maxBytes = 600_000): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError(415, "Send application/json.");
  if (Number(request.headers.get("content-length")) > maxBytes) throw new ApiError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "A JSON body is required.");
  let bytes = 0; const chunks: Uint8Array[] = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > maxBytes) { await reader.cancel(); throw new ApiError(413, "Request is too large."); } chunks.push(value); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new ApiError(400, "Invalid JSON."); }
}
export function checkLines(text: string) { if (text.split("\n").length > 2000) throw new ApiError(413, "Maximum 2,000 lines per analysis."); if (text.split("\n").some(line => line.length > 8192)) throw new ApiError(413, "Maximum 8,192 characters per message."); }
export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }); }
export function failure(error: unknown) { if (error instanceof ApiError) return json({ error: error.message }, error.status); if (error instanceof z.ZodError) return json({ error: "Invalid request fields.", details: error.issues.map(i => `${i.path.join(".")}: ${i.message}`) }, 400); return json({ error: "The request could not be completed." }, 500); }
