import { describe, expect, it } from "vitest";
import { safeDiagnostic } from "@/lib/ai/diagnostics";

describe("safe investigator diagnostics", () => {
  it("retains SDK type, cause status and billing reason without raw payloads", () => {
    const error = Object.assign(
      new Error(
        "Gateway requires a credit card. secret-key 8=FIX.4.4|private-log",
      ),
      {
        name: "GatewayInternalServerError",
        statusCode: 403,
        requestBodyValues: {
          authorization: "secret-key",
          prompt: "private-log",
        },
        responseBody: "private model output",
        cause: Object.assign(new Error("secret-key"), {
          name: "AI_APICallError",
          statusCode: 403,
        }),
      },
    );
    const result = safeDiagnostic(error, "generation");
    expect(result).toMatchObject({
      stage: "generation",
      errorType: "GatewayInternalServerError",
      upstreamStatus: 403,
      message: "Provider credit or billing unavailable",
      causeTypes: ["AI_APICallError"],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /secret-key|private-log|FIX|private model/,
    );
  });
  it("withholds unrecognized error messages and arbitrary error names", () => {
    const result = safeDiagnostic(
      { name: "secret-name", message: "8=FIX.4.4|secret-token", cause: null },
      "generation",
    );
    expect(result.errorType).toBe("UnrecognizedError");
    expect(result.upstreamStatus).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/secret|FIX/);
  });
  it("handles circular causes without serializing errors", () => {
    const error: { name: string; cause?: unknown } = { name: "Error" };
    error.cause = error;
    expect(safeDiagnostic(error, "schema_validation").causeTypes).toEqual([]);
  });
});
