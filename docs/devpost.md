# FIX Detective — an AI-assisted trading incident investigator

## Inspiration

A repeated message can look like a repeated trade. FIX Detective makes the distinction visible, linking reconstructed order state and anomalies to the exact underlying evidence.

## What it does

Hawkeye's FIX Detective accepts a narrow supported FIX 4.4 subset, reconstructs order lifecycles, excludes repeated execution deliveries, and exposes missing or conflicting evidence. Operators can inject a duplicate, remove an acknowledgment or shuffle delivery, then inspect timelines, source fields and a reproducible JSON report. Historical price comparisons carry explicit provenance. A protected AI investigator explains server-recomputed evidence using source references when Gateway credentials are configured.

All executions are simulated. No orders or funds are involved. Synthetic fixture market prices are clearly distinguished from external Alpaca IEX data.

## How we built it

A single Next.js App Router application with TypeScript, Tailwind CSS and request-scoped Node route handlers. A modular deterministic analyzer uses fixed-point BigInt quantities and session-scoped identities. Historical adapters are separate from the reducer. The Vercel AI SDK and AI Gateway produce structured explanations; the server validates source IDs and never accepts client totals as authority.

## Reliability work

Tests exercise duplicate invariants, interleaved sessions, reconciliation, missing history, cancel semantics, malformed/unsupported fields, ordering and provider failures. Browser tests exercise real HTTP analysis, fault injection, historical context, evidence navigation and export. Seeded benchmarks measure the application analyzer with known expected totals; raw results and methodology are included.

## Challenges and lessons

FIX version-specific enums matter: a FIX 4.4 trade is ExecType F. Identifier scope and event order cannot be inferred from arrival order alone. Historical bar closes become knowable at the end of their intervals, and limited-feed prices are not the whole market. AI citations can be checked for existence without proving the explanation is correct.

## Limitations and next steps

This is a bounded demo investigator, not a complete FIX engine or execution-quality adjudicator. Wire checksum/body-length validation, corrections/busts, overnight sessions and distributed public-user rate limiting are outside scope. Live Alpaca and AI operation require credentials; public deployment requires a connected Vercel account. Current validation and local benchmark evidence are documented, without claiming unperformed deployed checks.
