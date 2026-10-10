import "server-only";

export type FailureStage =
  "generation" | "schema_validation" | "evidence_validation";

// Never serialize SDK errors: they can contain request bodies, headers and model text.
// Only emit recognized diagnostic phrases; all other message content is withheld.
export function safeDiagnostic(error: unknown, stage: FailureStage) {
  const chain: Record<string, unknown>[] = [];
  let current = error;
  for (let i = 0; i < 5 && current && typeof current === "object"; i++) {
    const item = current as Record<string, unknown>;
    if (chain.includes(item)) break;
    chain.push(item);
    current = item.cause;
  }
  const knownTypes =
    /^(?:Gateway(?:Authentication|Forbidden|InvalidRequest|ModelNotFound|NotFound|RateLimit|FailedDependency|Response|Timeout|InternalServer)Error|AI_(?:APICall|NoObjectGenerated|TypeValidation|JSONParse|NoOutputGenerated)Error|ZodError|AbortError|TimeoutError|Error|ApiError)$/;
  const types = chain.map((item) =>
    typeof item.name === "string" && knownTypes.test(item.name)
      ? item.name
      : "UnrecognizedError",
  );
  const status = chain
    .map((item) => item.statusCode)
    .find(
      (value) =>
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 100 &&
        value <= 599,
    );
  const messages = chain
    .map((item) => (typeof item.message === "string" ? item.message : ""))
    .join(" ");
  const patterns: [RegExp, string][] = [
    [/invalid.*schema|schema.*invalid/i, "Upstream rejected the output schema"],
    [
      /authentication failed|invalid api key|unauthorized/i,
      "Gateway authentication failed",
    ],
    [
      /credit card|insufficient.*(?:credit|balance)|(?:credit|balance).*insufficient|payment required/i,
      "Provider credit or billing unavailable",
    ],
    [
      /model.*(?:not found|not supported|unavailable)|unknown model/i,
      "Requested model unavailable",
    ],
    [/rate limit|too many requests/i, "Provider rate limit exceeded"],
    [
      /no object generated|did not match schema|type validation|invalid structured/i,
      "Generated output failed structured validation",
    ],
    [
      /nonexistent source evidence/i,
      "Generated output cited nonexistent evidence",
    ],
    [
      /without evidence references/i,
      "Generated fact omitted evidence references",
    ],
    [/timeout|timed out|aborted/i, "Generation aborted or timed out"],
  ];
  return {
    event: "investigator_failure",
    stage,
    errorType: types[0] ?? "UnknownError",
    causeTypes: types.slice(1),
    message:
      patterns.find(([pattern]) => pattern.test(messages))?.[1] ??
      "Error message withheld (unrecognized diagnostic)",
    upstreamStatus: status ?? null,
  };
}

export function logInvestigatorFailure(error: unknown, stage: FailureStage) {
  console.error(JSON.stringify(safeDiagnostic(error, stage)));
}
