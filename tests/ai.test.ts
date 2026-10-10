import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("ai", () => ({ generateText: vi.fn(), Output: { object: vi.fn() } }));
vi.mock("@ai-sdk/gateway", () => ({
  createGateway: vi.fn(() => vi.fn(() => "mock-model")),
}));
import { generateText } from "ai";
import { POST } from "@/app/api/investigate/route";
import {
  investigate,
  investigateSchema,
  validateCitations,
} from "@/lib/ai/investigator";
import { analyze } from "@/lib/fix/report";
import { samples } from "@/lib/fixtures";
const input = { text: samples[0].text, question: "Were fills counted twice?" };
const report = analyze(input.text);
const sourceId = report.sources[0].id;
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("AI plumbing (mocked model, not hallucination proof)", () => {
  it("rejects nonexistent citations", () => {
    expect(() =>
      validateCitations(
        {
          sections: [
            {
              category: "Verified facts",
              claims: [{ text: "A trade.", sourceIds: ["invented"] }],
            },
          ],
        },
        new Set([sourceId]),
      ),
    ).toThrow(/nonexistent/);
  });
  it("rejects uncited facts", () => {
    expect(() =>
      validateCitations(
        {
          sections: [
            {
              category: "Verified facts",
              claims: [{ text: "A trade.", sourceIds: [] }],
            },
          ],
        },
        new Set([sourceId]),
      ),
    ).toThrow(/without evidence/);
  });
  it("recomputes authoritative evidence and uses the real SDK contract", async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: {
        sections: [
          {
            category: "Verified facts",
            claims: [
              {
                text: "The request is in the evidence.",
                sourceIds: [sourceId],
              },
            ],
          },
        ],
      },
    } as never);
    const out = await investigate(
      investigateSchema.parse({ ...input, totals: "999999" }),
    );
    expect(out.sections[0].claims[0].sourceIds).toEqual([sourceId]);
    const call = vi.mocked(generateText).mock.calls[0][0];
    const prompt = JSON.parse(call.prompt as string);
    expect(prompt.authoritativeEvidence.report.summary.observedFilledQty).toBe(
      "150",
    );
    expect(call.maxRetries).toBe(0);
    expect(call.maxOutputTokens).toBe(2200);
  });
  it("returns unavailable when the provider fails", async () => {
    vi.mocked(generateText).mockRejectedValue(
      new Error("upstream failed with private info"),
    );
    await expect(investigate(investigateSchema.parse(input))).rejects.toThrow(
      "Live AI is unavailable",
    );
  });
  it("disables paid usage when no operator gate is configured", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-only-key");
    vi.stubEnv("INVESTIGATOR_ACCESS_TOKEN", "");
    const response = await POST(
      new Request("http://test/api/investigate", { method: "POST" }),
    );
    expect(response.status).toBe(503);
    expect(generateText).not.toHaveBeenCalled();
  });
  it("rejects an incorrect shared access code before calling the model", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-only-key");
    vi.stubEnv(
      "INVESTIGATOR_ACCESS_TOKEN",
      "test-only-access-token-32-characters-long",
    );
    const response = await POST(
      new Request("http://test/api/investigate", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(response.status).toBe(401);
    expect(generateText).not.toHaveBeenCalled();
  });
  it("accepts authorized requests with valid model output", async () => {
    const access = "test-only-access-token-32-characters-long";
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-only-key");
    vi.stubEnv("INVESTIGATOR_ACCESS_TOKEN", access);
    vi.mocked(generateText).mockResolvedValue({
      output: {
        sections: [
          {
            category: "Unknowns",
            claims: [
              { text: "Routing context is not available.", sourceIds: [] },
            ],
          },
        ],
      },
    } as never);
    const response = await POST(
      new Request("http://test/api/investigate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${access}`,
        },
        body: JSON.stringify(input),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain(access);
  });
});
