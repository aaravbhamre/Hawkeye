# Two-minute demo

1. **0:00–0:15 — Load clean sample.** Click **Load clean sample**. The browser makes a real `/api/analyze` request. Show 8 messages, 2 reconciled orders, 4 unique fills, and **150 observed shares**. AAPL is 100 shares at 190.6 weighted average; MSFT is 50 at 419.4.
2. **0:15–0:35 — Inject the fault.** Click **Inject duplicate fill**. There are now 9 source messages and one duplicate delivery, but filled quantity remains **150**. The repeated AAPL execution has the same session/ExecID and is excluded once.
3. **0:35–0:50 — Prove it with evidence.** Select **ORD-1001**. Show the repeated event in the timeline. Click a source reference to expand its exact fields and filename/line.
4. **0:50–1:10 — Historical context.** Select the execution **15:32:10.000 · 60 @ 191** and the **Fixture** data source. Click **Check execution price**. Explain the clearly labeled synthetic completed bar: 190.25 close, available at 15:32:00 UTC, 10 seconds before execution. Buy-side adverse difference is **39.421813 bps**, above the 25 bps review threshold. This is approximate context, not misconduct proof. If Alpaca credentials are configured, separately choose Alpaca and show its external IEX provenance; its real prices will differ from the fixture.
5. **1:10–1:35 — Investigate.** With configured Gateway access, enter the private operator code and ask **Were any fills counted twice?** Show the returned live response categories and click its source citations. Explain that citation-ID validation is not entailment proof. Without credentials, show the honest unavailable state; do not present it as a successful AI demonstration.
6. **1:35–1:50 — Missing context.** Click **Remove acknowledgment**. Observed quantity stays 150, but both orders become unresolved. Click **Shuffle delivery** to show that sufficient timestamps/sequences preserve economic results, while source line positions change.
7. **1:50–2:00 — Export and reset.** Click **Export JSON** for the exact analysis and retained comparisons, then **Reset** to restore the selected fixture. Comparisons/chat clear after a new analysis so stale evidence is not reused.

## Before a presentation

Run `npm run check`, then `HAWKEYE_TEST_MODE=production npm run test:e2e`. Confirm a live model call and live Alpaca lookup separately if advertising these as available; mocked tests do not establish service readiness. Set an appropriate Gateway spending cap. Never put the operator code in a recording, public link, repository or slide.

## Public deployment verification (run after Vercel is connected)

- Open the deployed application and inspect a successful `/api/analyze` network response.
- Repeat clean → duplicate: total 150, four unique fills, one duplicate delivery.
- Follow timeline/finding/AI references to source details.
- Confirm fixture versus external labels, historical timestamps, and transparent provider errors.
- Verify unauthorized AI returns 401 or unavailable 503, and authorized live AI returns an evidence-linked explanation when configured.
- Download JSON and inspect its totals, source messages and provider provenance.
- Inspect browser scripts and network responses for accidental credentials. Only the operator's intentionally submitted access header may contain that operator code; upstream credentials must never be sent to the browser.
- Test mobile layout and upload a small synthetic log.

Deployment verification is pending until a real deployment exists; these steps are not claimed as completed remotely.
