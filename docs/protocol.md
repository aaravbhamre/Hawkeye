# Supported FIX subset and evidence policy

## Scope and verified meanings

FIX **4.4** only. Enum meanings were checked against [QuickFIX's FIX44.xml](https://github.com/quickfix/quickfix/blob/master/spec/FIX44.xml), not inferred from old FIX versions.

| Message           | Supported interpretation                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `35=D`            | New Order Single; buy `54=1` / sell `54=2`; market `40=1` or limit `40=2` (requires Price 44) |
| `35=8,150=0,39=0` | New acknowledgment                                                                            |
| `35=8,150=F,39=1` | Trade leaving the order partially filled                                                      |
| `35=8,150=F,39=2` | Trade completing the order                                                                    |
| `35=8,150=4,39=4` | Confirmed cancellation                                                                        |
| `35=8,150=8,39=8` | Rejection                                                                                     |
| `35=F`            | Cancel request; **does not cancel the order**                                                 |

FIX 4.4 uses `ExecType=F` for a trade, with OrdStatus indicating partial/full. Corrections (`150=G`), trade cancels/busts (`150=H`), replacements, cancel rejects, pending states, status-only reports and other message types are unsupported findings, not silently applied. Non-trade reports may carry zero LastQty/LastPx; only a supported Trade contributes fills.

Headers require 8/35/49/56/34/52. New requests require 11/55/54/38/40. Execution reports require 37/17/150/39/55/54/14/151/6; trades additionally require positive LastQty (32) and LastPx (31). Cancel requests require 11/41/55/54/38. These are **application-subset requirements**, not full FIX dictionary validation.

## Wire validation

One message per nonblank line, either SOH-delimited or a **pipe-delimited demo representation**. Optional trailing delimiter; no raw-log timestamp prefix stripping or multiple messages on one line. Mixed delimiters and malformed tokens are findings. Fields retain original order, duplicate tags, unknown tags and raw values. Duplicate tags prevent unambiguous normalization.

**BodyLength (9), CheckSum (10), full header/trailer ordering and wire framing are not validated.** They are preserved if supplied. Neither SOH acceptance nor pipe normalization establishes wire validity. Pipe messages must never be labeled wire-valid. All FIX 4.4 NumInGroup tags from the QuickFIX dictionary are explicitly rejected as unsupported repeating groups. Unknown scalar fields are retained with a warning and not interpreted.

## Identity and ordering

- Session identity: FIX version + lexically sorted SenderCompID/TargetCompID pair + UTC date of OrigSendingTime if present, otherwise SendingTime. This pairs both directions while separating independent counterparty pairs and days.
- Assumptions: one logical session per counterparty pair/day, no intraday resets, no reused order IDs within that scope, no overnight order continuation. Sub-session identifiers/reset features are explicitly unsupported when present; split captures if multiple sessions reuse the same pair/date.
- Correlation: session-scoped ClOrdID (11), OrigClOrdID (41) and broker OrderID (37) aliases joined by messages. Cancel ClOrdID is an alias of its OrigClOrdID, not a new order. Responses without a link to the request remain orphan groups. Multiple requests, broker identities or conflicting symbol/side are findings.
- Deduplication key: session + ExecID (17), assumed unique for that broker pair and trading date. Equal normalized business fields are repeated deliveries, even if transport sequence, PossDupFlag or SendingTime differ. Business signature includes IDs, type/status, symbol/side, quantities/prices, and effective event timestamp. Decimal spellings are canonicalized. Different legitimate ExecIDs are never collapsed for having equal size/price. Conflicting signatures for one ExecID quarantine **all versions** from the observed fill total.
- Source ID: first 128 bits of SHA-256 of the exact original line, plus occurrence ordinal for identical raw lines. Unique-message IDs survive shuffling; filename/line remains the actual submitted location. IDs are evidence locators, not cryptographic authenticity guarantees.
- Timestamp: strict calendar-valid UTC `YYYYMMDD-HH:mm:ss[.SSS]`, zero to three fractional digits. No local-time guessing or leap-second/sub-millisecond support. Event time uses TransactTime (60), otherwise OrigSendingTime (122), otherwise SendingTime (52). PossDupFlag=Y requires 122.
- Chronology: timestamp, then sender, sender sequence, source ID. Same-time same-sender unique sequences resolve ordering. Equal-time cross-direction or repeated-sequence events are **ambiguous**; sender/source tie-breaking is for deterministic display, not proof of chronology. Sequence numbers are never compared across directions as a causal clock. Reused sequence numbers produce findings. This subset does not establish transport gap-freeness from sequence gaps.
- Identical input/configuration yields identical structured reports. A shuffled log can preserve quantities, states and stable unique source IDs when ordering evidence suffices, but its digest, raw source order and line numbers necessarily change.

## Quantities and contradictions

Authoritative decimal inputs are nonnegative, at most 12 integer and 6 fractional digits; requested/fill quantities and trade/limit prices must be positive. Arithmetic uses scaled BigInt (10^6), not floating-point sums. Outputs are decimal strings; weighted prices and basis points truncate toward zero at six places. AvgPx reconciliation tolerates one millionth for rounding.

Observed filled quantity is the sum of unique, undisputed supported LastQty values. The reducer checks cumulative and leaves quantities, weighted AvgPx, terminal/partial state quantities, overfills, responses predating requests, and reports after terminal states. The headline total sums observed quantities across the capture; it is not a currency value or portfolio exposure.

A complete supported history requires a request and new acknowledgment (or rejection), no invalid/unsupported excluded input, no timing/correlation conflicts, and consistent quantities. Missing requests/acknowledgments and pending unconfirmed cancels remain unresolved. Reported CumQty/LeavesQty are retained as evidence; they never manufacture missing fills. A reconciled prefix does not prove no later messages exist outside the capture.

## Deliberate limitations

This is a supported-subset investigator, not a session engine or a complete FIX validator. No FIXT, repeating groups, multi-leg orders, allocations, short sales, replace chains, execution corrections/busts, recovery replay negotiation, or multi-day correlation. Currency, account and asset-class normalization are not implemented in the analyzer; use homogeneous order economics. Historical comparison is specifically USD common-stock context and rejects contradictory Currency/SecurityType evidence on the selected execution. The adapters cannot prove a ticker uniquely identifies a security across corporate actions.
