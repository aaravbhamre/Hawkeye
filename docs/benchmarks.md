# Local benchmark evidence

Measured 2026-10-10T19:04:51.887Z on Node v24.19.0, linux x64, AMD EPYC 9V45 96-Core Processor. The container exposed 4 usable CPUs (quota 4 cores) and a 32 GiB memory limit. The analyzer itself runs synchronously on one JavaScript thread. These are local cloud-workspace measurements, **not deployed Vercel throughput**.

```bash
npm run benchmark
```

The seeded generator (`scripts/workload.ts`, seed 2025) produces 100, 1,000 and 5,000 orders. Each has a request, acknowledgment, 40-share partial fill and 60-share completion. Every tenth order includes one repeated fill delivery. Two sessions, two symbols, 50/50 buy/sell, synthetic prices and a deterministic global shuffle. Expected quantity = orders × 100; distinct fills = orders × 2. Every measured and warm-up iteration asserts these quantities, order counts, duplicate counts and zero unresolved orders.

Two warm-ups and five measured runs **per size**; latency encloses the same `analyze()` used by the API, excluding workload generation, assertions and JSON serialization. Market API, model, network, HTTP and browser latency are excluded. Median is the third sorted sample; p95 is nearest-rank and, with five runs, is simply the slowest run. This is a small sample, not a tail-latency guarantee. Timing runs were made after the production checks, with the development server idle; no build was running concurrently.

| Messages | Median ms |  p95 ms | Messages / second (median) | Process peak RSS MiB |
| -------: | --------: | ------: | -------------------------: | -------------------: |
|      410 |    10.257 |  13.323 |                     39,972 |                 92.3 |
|    4,100 |    90.375 | 101.072 |                     45,367 |                255.9 |
|   20,500 |   439.302 | 505.499 |                     46,665 |                557.7 |

[Raw results](benchmark-results.json) preserve every run, input sizes, input digests, exact runtime and resource metadata. RSS is for the entire benchmark process (including generated logs, retained objects and GC behavior), and the peak is cumulative across sizes, **not** isolated per-request allocation. No forced GC is used. Workloads beyond the HTTP input cap exercise standalone scaling only; they are not accepted as one application request.

## Observed bottleneck

A separate CPU profile of five 5,000-order analyses found normalization to be the largest individual application self-sampling function (356 samples), followed by tokenization (234), validation (166), and reduction (123); garbage collection accounted for 265 samples. Date parsing, repeated field-object creation, decimal canonicalization and retained source evidence dominate, rather than provider I/O. This is sampled CPU evidence, not an attribution of exact elapsed milliseconds. The full source report intentionally retains detailed evidence, trading memory for inspectability.

Reproduce a separate profile (does not overwrite benchmark measurements):

```bash
node --cpu-prof --cpu-prof-dir=/tmp --cpu-prof-name=hawkeye.cpuprofile --import tsx -e 'const {analyze}=require("./lib/fix/report.ts"); const {workload}=require("./scripts/workload.ts"); const {text}=workload(5000); for(let i=0;i<5;i++)analyze(text,"profile.fix");'
```

The recorded profile was taken during final correctness work; the subsequent report aggregation guard changes are covered by the final timing results above. All measurements are reproducible commands, not promised production capacity. Remaining optimization candidates are sharing validated field/timestamp representations and reducing temporary allocations, with invariant tests retained.
