# Simulated holdings and latest-price snapshots

The dark trading workspace adapts the two user-supplied visual references: charcoal panels, compact navigation and dense desktop information, lime/red price movement, and a single-column mobile layout. Charts show actual adapter observations; candlesticks and volumes are not invented from close-only fixtures. There is no order-placement control.

## Accounting and completeness

`POST /api/holdings` accepts the same bounded capture as analysis. The server reruns the analyzer and calculates holdings in `lib/holdings/accounting.ts`; it never accepts client-calculated quantities, cost basis, prices or P/L. Only unique, undisputed ExecType F fills count. New orders, acknowledgments and unfilled canceled quantities do not acquire stock. Source references remain attached to each position.

Each FIX session/symbol is a separate simulated book. Sessions are never silently combined into a real brokerage account. Portfolio totals sum these independent books under that explicit simulation assumption. Account tag 1, non-USD currency or non-common-stock declarations make the book incomplete. Absent security/currency tags are interpreted as USD common stock, consistent with this narrow equity demo. Cross-session real-account reconciliation is unsupported.

Without opening positions, **zero must not be inferred**. The user must explicitly declare a complete capture with zero opening positions in every session before cost basis and valuation are enabled. This is recorded as `zeroOpeningPositions` in exports. That declaration is not proof of log completeness. Loading, reanalyzing or fault-transforming a capture resets it. Sell-only or oversold books remain incomplete even with the declaration. Short positions and nonzero opening balances are not supported. Unknown opening positions still show the **net change observed in the log**, not a claimed actual account balance.

Use moving weighted-average cost:

- Buy: add `LastQty × LastPx` to inventory cost, add LastQty to shares.
- Sell within inventory: subtract a proportional share of the existing inventory cost, subtract LastQty from shares. Sale proceeds do not change the average cost of remaining shares.
- Remaining average cost = remaining inventory cost / remaining shares.
- Market value = remaining shares × available price.
- Unrealized P/L = market value − remaining cost; percentage = P/L / remaining cost × 100. Zero-cost percentages are unavailable.

Quantities and prices use six-decimal BigInt fixed point. Inventory cost retains twelve decimal places; proportional sell reductions truncate toward zero at that precision. Display outputs truncate to six decimal places; UI money rounds to cents for readability. Floating-point arithmetic is used only for chart coordinates and display formatting. Closed positions have zero cost/value/unrealized P/L; realized P/L is not reported.

Fill chronology uses UTC event time and same-sender sequence numbers. Cross-order equal-time events without unique comparable sequence evidence mark the book incomplete. Conflicting/missing order histories also invalidate its cost basis. Invalid messages and unresolved orders suppress portfolio totals. Duplicate delivery and unambiguous shuffled delivery preserve holdings. A price older than the last fill cannot value that holding. Portfolio totals appear only when every included book is reconciled and every open position has a usable price. No partial total is presented as the full portfolio.

Fees, FX, taxes, dividends, splits, transfers, corporate actions, trade corrections and short inventory are outside the supported accounting. Unadjusted price comparisons across long date ranges may therefore be economically misleading even when arithmetic is correct. These are simulated snapshot valuations, not live account statements.

## Latest prices versus execution comparisons

The holdings price source is independent of the historical-price context panel. Refresh calls `/api/holdings` with `refresh: true`; Alpaca is never fetched implicitly when analyzing a new capture. Fixture snapshots are populated for the demonstration. Refresh errors preserve deterministic holdings and clear price-based totals; external failures never cause an automatic fixture fallback.

Alpaca uses the existing server-only credentials `ALPACA_API_KEY` and `ALPACA_API_SECRET`:

- One batched `/v2/stocks/snapshots?symbols=…&feed=iex` request: latest trade price and actual trade timestamp.
- One batched `/v2/stocks/bars` request: `timeframe=1Day`, `feed=iex`, `adjustment=raw`, at most 45 calendar days, `limit=1000`. The end is fifteen minutes before retrieval; the most recent daily bar can still be partial.
- At most 12 distinct supported symbols, no pagination loop or retry, shared eight-second deadline for both requests. Missing or truncated history is disclosed. History failure does not discard a successful latest trade.
- IEX covers a single exchange, not the consolidated market or NBBO. Latest trades can be old during closures or sparse trading. Every price has its own timestamp; retrieval time is separate. Prices are never described as live.

Endpoints verified against the official [Alpaca Python stock client](https://github.com/alpacahq/alpaca-py/blob/master/alpaca/data/historical/stock.py). Provider account entitlements and rate limits still apply. External response numbers must fit the supported positive six-decimal price representation.

Fixtures contain ten explicitly synthetic illustrative price observations per AAPL/MSFT, ending January 15, 2025 at 21:00 UTC. They are not current or real historical prices. Unknown symbols have no fixture price. `/api/market` continues to use a completed minute bar at or before the selected execution; it does not use these latest-price snapshots.

## Reproduce the holdings demonstration

1. Choose **Holdings demo · buys + partial sale**.
2. Confirm the complete-history/zero-opening-position declaration.
3. AAPL: buy 100 with cost $19,060, sell 25, leaving 75 with cost $14,295 (average $190.60). Fixture $195 → value $14,625, unrealized gain $330.
4. MSFT: buy 50 with cost $20,970 (average $419.40). Fixture $415 → value $20,750, unrealized loss $220.
5. Total fixture market value: **$35,375**. Total remaining cost: **$35,265**. Unrealized gain: **$110**.
6. Select a holding to inspect its chart, follow its execution evidence, refresh snapshots, or export JSON including holdings assumptions and provenance.
7. The original clean FIX sample includes an MSFT sell without opening inventory. Its portfolio total correctly remains incomplete.
