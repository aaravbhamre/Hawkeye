import { performance } from "node:perf_hooks";
import { availableParallelism, cpus, platform, arch, totalmem } from "node:os";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { analyze } from "../lib/fix/report";
import { workload } from "./workload";
const warmups = 2, runs = 5;
const sizes = [100, 1000, 5000];
const cgroup = (name: string) => { try { return readFileSync(`/sys/fs/cgroup/${name}`, "utf8").trim(); } catch { return "unavailable"; } };
const results = sizes.map(orders => {
  const data = workload(orders);
  const timings: number[] = [];
  let digest = "";
  const rssBefore = process.memoryUsage().rss;
  for (let i = -warmups; i < runs; i++) {
    const start = performance.now();
    const report = analyze(data.text, "benchmark.fix");
    const elapsed = performance.now() - start;
    assert.equal(report.summary.observedFilledQty, data.expected.quantity);
    assert.equal(report.summary.orders, orders);
    assert.equal(report.summary.uniqueFills, data.expected.fills);
    assert.equal(report.summary.duplicateDeliveries, data.expected.duplicates);
    assert.equal(report.summary.unresolvedOrders, 0);
    if (digest) assert.equal(report.inputDigest, digest);
    digest = report.inputDigest;
    if (i >= 0) timings.push(elapsed);
  }
  const sorted = [...timings].sort((a, b) => a - b);
  const medianMs = sorted[Math.floor(sorted.length / 2)];
  return { ...data.expected, inputBytes: Buffer.byteLength(data.text), inputDigest: digest, runMs: timings.map(n => Number(n.toFixed(3))), medianMs: Number(medianMs.toFixed(3)), p95Ms: Number(sorted[Math.ceil(sorted.length * .95) - 1].toFixed(3)), messagesPerSecond: Math.round(data.expected.messages / medianMs * 1000), rssBeforeBytes: rssBefore, rssAfterBytes: process.memoryUsage().rss, processPeakRssBytes: process.resourceUsage().maxRSS * 1024 };
});
const result = { measuredAt: new Date().toISOString(), scope: "Local deterministic analysis only; excludes HTTP, browser, market-data and AI latency. Not a deployed benchmark.", command: "npm run benchmark", runtime: process.version, platform: `${platform()} ${arch()}`, cpu: cpus()[0]?.model, availableCpu: availableParallelism(), hostMemoryBytes: totalmem(), cgroup: { cpuMax: cgroup("cpu.max"), memoryMax: cgroup("memory.max") }, seed: 2025, warmups, runs, workload: "Each order: request, acknowledgment, 40-share partial fill, 60-share final fill. 10% of orders add one repeated fill delivery. Two sessions and two symbols; seeded global shuffle. Prices are synthetic. Every iteration asserts known totals.", results };
mkdirSync("docs", { recursive: true });
writeFileSync("docs/benchmark-results.json", JSON.stringify(result, null, 2) + "\n");
console.table(results.map(({ messages, medianMs, p95Ms, messagesPerSecond, processPeakRssBytes }) => ({ messages, medianMs, p95Ms, messagesPerSecond, peakRssMiB: Math.round(processPeakRssBytes / 1024 / 1024) })));
console.log("Measured results saved to docs/benchmark-results.json");
