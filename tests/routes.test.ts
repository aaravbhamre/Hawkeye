import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/analyze/route";
import { samples } from "@/lib/fixtures";
const request = (body: unknown) =>
  new Request("http://test/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
describe("analyze route", () => {
  it("returns authoritative results and ignores client totals", async () => {
    const response = await POST(
      request({ text: samples[0].text, totals: { filled: "999" } }),
    );
    expect(response.status).toBe(200);
    const report = await response.json();
    expect(report.summary.observedFilledQty).toBe("150");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects blank input", async () => {
    expect((await POST(request({ text: " " }))).status).toBe(400);
  });
  it("preserves source-line locations including leading blank lines", async () => {
    const response = await POST(request({ text: "\n\n" + samples[0].text }));
    expect((await response.json()).sources[0].line).toBe(3);
  });
  it("bounds lines", async () => {
    expect((await POST(request({ text: "x\n".repeat(2001) }))).status).toBe(
      413,
    );
  });
  it("bounds actual streamed body bytes", async () => {
    expect((await POST(request({ text: "x".repeat(610_000) }))).status).toBe(
      413,
    );
  });
  it("returns malformed messages as evidence with findings", async () => {
    const response = await POST(request({ text: "invalid" }));
    expect(response.status).toBe(200);
    const report = await response.json();
    expect(report.sources[0].raw).toBe("invalid");
    expect(report.findings.length).toBeGreaterThan(0);
  });
  it("rejects invalid JSON", async () => {
    expect(
      (
        await POST(
          new Request("http://test", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{",
          }),
        )
      ).status,
    ).toBe(400);
  });
});
