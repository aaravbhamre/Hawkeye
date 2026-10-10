# Hawkeye · FIX Detective

An evidence-first, AI-assisted investigator for **simulated** trading incidents. One Next.js application; real browser-to-server requests; no database, user accounts, real orders, or funds.

Load a session, inject a repeated execution, prove the observed fill total stays correct, compare a fill with explicitly labeled historical context, and ask a protected AI investigator to explain the evidence.

## Run locally

Requires **Node.js 24 LTS** and npm. The repository root is the application root.

```bash
npm install
npm run dev
```

In this Codex cloud environment, run `export NODE_USE_ENV_PROXY=1` before starting Node so external HTTP requests use the configured proxy. The saved cloud startup instructions include this setting; ordinary Vercel deployments do not require a proxy.

No credentials are needed for analysis, fault injection, source inspection, synthetic market comparisons, or JSON export. The npm cache lives in the ignored `.npm-cache/` directory so installation works in the cloud workspace.

For external services, copy `.env.example` to `.env.local` and enter values locally or in secure environment settings. `.env.local` and all other `.env*` files except the empty example are ignored. Never use `NEXT_PUBLIC_` for credentials.

| Variable                              | Purpose                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| `ALPACA_API_KEY`, `ALPACA_API_SECRET` | Server-only Alpaca historical IEX data                                                       |
| `AI_GATEWAY_API_KEY`                  | Server-only Vercel AI Gateway authentication                                                 |
| `AI_MODEL`                            | Defaults to `openai/gpt-4.1-mini` (listed in the live Gateway catalog during implementation) |
| `INVESTIGATOR_ACCESS_TOKEN`           | Private random access code, 32–256 characters, required to enable paid AI                    |

Keep the investigator code private; trusted demo operators enter it in the dashboard. It is held in browser memory and sent over HTTPS only when asking AI. Generate it using a password manager or `openssl rand -hex 32`; set the same value in the server environment. Do not commit it or share it publicly. Restart development after changing environment variables.

## What works

- FIX 4.4 D / 8 / F messages; narrow, documented semantics; pipe demo and SOH input.
- Session-scoped correlation, execution deduplication, exact fixed-point quantities, and explicit reconciliation failures.
- Real `/api/analyze`, `/api/market`, and `/api/investigate` route handlers.
- Responsive dashboard, samples, file upload, fault injection, order timeline, exact source fields, and JSON export.
- Explicit synthetic fixture prices or external Alpaca IEX minute bars. No automatic provider fallback.
- Vercel AI SDK + Gateway structured explanations; recomputed evidence, bounded requests, protected paid access, and citation-ID validation.
- Core functionality survives missing credentials and upstream failures. Unavailable AI is labeled as unavailable, never replaced with canned output.

Read [protocol and limitations](docs/protocol.md) before interpreting reports. This is a challenge/demo investigator, not a complete FIX engine, certified execution-quality tool, or trading system.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run build
# Browser install needed only when Chromium is not already available:
npx playwright install chromium
HAWKEYE_TEST_MODE=production npm run test:e2e
npm run benchmark
```

`npm run check` combines lint, type checking, unit/integration tests, and production build. Browser tests start and stop an isolated application on port 3100. They use `/usr/bin/chromium` when available; otherwise Playwright's installed browser. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for a custom browser. Production browser tests require a successful build first. `npm run test:e2e` without the environment flag tests development mode; stop another development server first to avoid Next's development lock.

Tests cover analyzer invariants, malformed/unsupported input, route validation, market failures and timestamp/side calculations, mocked AI success/failure and bad citations, and the actual browser/backend demo. Mocked AI tests do not prove an LLM cannot hallucinate. Exact measurements and methodology: [benchmarks](docs/benchmarks.md), [raw results](docs/benchmark-results.json).

## GitHub and Vercel

This repository is Vercel-compatible with the Next.js preset, Node.js **24.x**, root directory `.`, install command `npm install`, and build command `npm run build`. No database or external service is required to deploy fixture mode.

1. Import `aaravbhamre/Hawkeye` in your Vercel account and choose the `main` branch.
2. Set the variables above in Vercel **Project Settings → Environment Variables**, for the intended preview/production environments. Keep all credentials server-only. Fixture mode needs none.
3. Configure a Gateway spending limit appropriate to the demo, keep the operator code private, and redeploy after changing variables.
4. Follow [the two-minute demo and deployed verification checklist](docs/demo.md). Confirm external/AI operations on the deployed instance; a local build is not deployment evidence.

Paid AI protection is a stateless shared operator code, not process-local rate limiting. It closes the paid endpoint to anonymous visitors and fails closed when unset or shorter than 32 characters. It is suitable for a private demo, not a public multi-user service. A leaked code can be abused; rotate it and use Gateway spending controls. Add managed distributed rate limiting/authentication before granting public paid access.

## Project notes

- [Architecture](docs/architecture.md)
- [Protocol policy and limitations](docs/protocol.md)
- [External APIs and implementation disclosures](docs/dependencies.md)
- [Benchmark methodology and results](docs/benchmarks.md)
- [Demo script](docs/demo.md)
- [Devpost-ready description](docs/devpost.md)

The implementation was built from an empty repository using the supplied project prompt. No Lucera challenge or starter-guide attachments were accessible, so they were not read. Generated Next.js boilerplate and third-party dependencies are disclosed separately from the analyzer, adapters, interface, tests, and benchmark authored for this project.
