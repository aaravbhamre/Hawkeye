# Architecture

One deployable Next.js App Router application, using Node route handlers. Every investigation is request-scoped; there is no database or shared mutable analysis state. The browser owns editable input and display state, never authoritative totals.

```mermaid
flowchart LR
  UI[Dashboard / source input] -->|POST log text| Analyze[/api/analyze]
  Analyze --> Parser[Tokenize → validate → normalize]
  Parser --> Engine[Correlate → deduplicate → reduce → report]
  UI --> Holdings[/api/holdings]
  Holdings --> Engine
  Holdings --> Inventory[Weighted-average inventory / fixed-point valuation]
  Holdings --> Snapshots[Separate latest snapshots and daily bars]
  UI --> Market[/api/market]
  Market --> Engine
  Market --> Adapters[Fixture or Alpaca historical adapter]
  Adapters --> Decimal[Fixed-point price comparison]
  UI -->|Private operator code| AI[/api/investigate]
  AI --> Engine
  AI --> Adapters
  AI --> Gateway[Vercel AI SDK / AI Gateway]
  Gateway --> Citations[Validate structured output and source IDs]
```

## Responsibilities

- `lib/fix/tokenize.ts`: one message per nonblank line; delimiter handling; ordered fields; exact original source; stable content-derived IDs.
- `validate.ts`: required supported fields, enums, decimals, UTC timestamps, unsupported group/session features. Invalid records stay in source evidence but do not become events.
- `normalize.ts`: typed events, decimal canonicalization, session and timestamp policy.
- `correlate.ts`: union of session-scoped client and broker aliases, independent of arrival order.
- `deduplicate.ts`: session/ExecID grouping, business-signature comparison, repeated-delivery exclusion and disputed-version quarantine.
- `reduce.ts`: chronology, observed fill quantities and weighted price, state and quantity reconciliation. It never takes client-calculated totals.
- `report.ts`: deterministic composition, findings, digest, summary, orders and original source evidence.
- `lib/market`: bounded adapters and deterministic price arithmetic, distinct from the analyzer.
- `lib/ai`: stateless access gate, bounded authoritative reanalysis, structured SDK response and citation checks.

There is no background agent, execution API, persistent log store, or process-local usage counter. Browser state resets on reload. JSON export captures the deterministic analysis plus any fetched comparisons and their provenance; transient processing time is not mixed into the analyzer output.

## Trust and bounds

The server reads the actual request stream with a 600 KB byte ceiling; input text is capped at 500,000 characters, 2,000 lines and 8,192 characters per line. API input filenames are bounded and sanitized by the upload UI. React renders raw fields as text, not HTML. API responses use `no-store`; errors do not echo provider bodies or credentials. Server-only imports guard credential-bearing adapters from client imports.

AI has a stricter 120 KB HTTP body, 60,000-character log and 200-message ceiling; at most three history turns, four market requests, a 1,200-character question, a 160,000-character evidence context, 2,200 output tokens and a 22-second model timeout. There are no retries. Historical requests run in parallel, each with an eight-second timeout; the route budget is 40 seconds. Client totals and prices are ignored. Client history is explicitly untrusted, and requested market references are fetched again on the server.

The paid endpoint fails closed unless both the Gateway key and a private operator code are present. Constant-time comparison uses SHA-256 digests. This is a demo access mechanism, not distributed rate limiting. Only source-ID existence and required fact citations are mechanically checked; evidence entailment, model reasoning and injection resistance are not proven.

## Failure semantics

Malformed/unsupported messages remain visible. Invalid records conservatively make all order reconciliation unresolved because their correlation keys may be unreliable. Disputed ExecID versions are excluded rather than arbitrarily selecting one. Upstream market/AI errors do not alter the report. No automatic synthetic fallback or latest-price substitution occurs.

The Holdings Overview uses `lib/holdings` for deterministic inventory calculations and `lib/market/latest.ts` for bounded latest snapshots, independently of historical execution comparisons. JSON exports include the opening-position declaration, quantities, prices and timestamps, provider/coverage limitations, and separate retrieval time. See [accounting policy](holdings.md).
