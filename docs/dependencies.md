# External services, sources and implementation disclosures

## Alpaca

The adapter uses `GET https://data.alpaca.markets/v2/stocks/bars` with `symbols`, `timeframe=1Min`, `feed=iex`, `adjustment=raw`, bounded `start`/`end`, `sort=desc`, `limit=6`. Authentication uses `APCA-API-KEY-ID` and `APCA-API-SECRET-KEY` headers. It never calls an order endpoint.

Verified against official [stock historical client](https://github.com/alpacahq/alpaca-py/blob/master/alpaca/data/historical/stock.py), [request models](https://github.com/alpacahq/alpaca-py/blob/master/alpaca/data/requests.py), [REST authentication](https://github.com/alpacahq/alpaca-py/blob/master/alpaca/common/rest.py), and [base URLs](https://github.com/alpacahq/alpaca-py/blob/master/alpaca/common/enums.py). Alpaca's [official getting-started source](https://github.com/alpacahq/alpaca-docs/blob/master/content/market-data/getting-started.md) distinguishes IEX from the paid SIP feed. The rendered reference page returned HTTP 403 in this environment; it was not treated as read successfully.

IEX is one exchange, **not the consolidated market or NBBO**. Account entitlement, history access, rate limits and current commercial terms must be verified in your Alpaca account; no live authenticated entitlement was established without credentials. The demonstration uses Jan 15, 2025 during US regular trading hours, well away from recent-data restrictions. Empty results, market closure/no trades, 401/403, 429, timeouts and provider errors are explicit; the application does not silently request SIP or switch providers.

Select the most recent completed minute bar at or before the execution, at most five minutes old. The API request excludes the still-forming execution minute. Both bar-start and bar-end timestamps are displayed; time distance is measured from **bar end**, since the close was not known at bar start. A close is approximate context, not a historical executable quote. Unadjusted prices may not be comparable across corporate actions; fees, spread, routing and other venues are not modeled.

## AI

Uses installed Vercel AI SDK `generateText` + `Output.object`, Zod structured output, and `createGateway` from `@ai-sdk/gateway`. API usage was checked against installed SDK documentation and types. `openai/gpt-4.1-mini` was verified in the public [Gateway model catalog](https://ai-gateway.vercel.sh/v1/models). Catalog availability does not establish successful authenticated model inference or account credits.

Evidence and user questions leave the server for Gateway/the model provider only after an operator-authorized AI request. Do not upload confidential logs without appropriate authorization. Nothing instructs the model to execute orders, and no execution tool exists. Prompts label log contents/history as untrusted. Structured output and valid citation IDs constrain responses; they do not prove all claims follow from their citations or eliminate prompt injection/hallucination.

## Libraries and original work

- Next.js / React / TypeScript application scaffold: official `create-next-app` 16.4.0 template, adapted for request-scoped Node routes and system fonts.
- Tailwind CSS / its Turbopack integration: styling infrastructure; custom dashboard layout/styles authored here.
- Lucide React: open-source icons. No paid component template or external image dataset.
- AI SDK / Gateway, Zod: provider communication and schema validation.
- Vitest, Playwright, tsx: test and benchmark tooling.
- QuickFIX FIX44.xml: verified protocol enums and generated list of unsupported NumInGroup tags. No third-party parser/reducer implementation copied.
- Node standard library: crypto hashes, fixed-point BigInt arithmetic, performance measurement.

The parser, correlation/deduplication/reducer, report format, fixture logs/prices, fault transforms, dashboard, adapters, access gate, citation validation, tests and seeded benchmark were implemented during this project. All execution logs and fixture market prices are synthetic and hand-calculable. No real trading/session dataset, real executions or funds are used. Lockfile records exact dependency versions.
