"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Activity, ArrowDownToLine, ArrowRight, Check, ChevronRight, CircleHelp, Copy, FileText, Fingerprint, FlaskConical, LoaderCircle, MessageSquare, Play, RotateCcw, ScanSearch, ShieldCheck, Shuffle, Sparkles, Upload, X } from "lucide-react";
import { injectFault, samples, type Fault } from "@/lib/fixtures";
import type { Finding, Report } from "@/lib/fix/types";
import type { Comparison } from "@/lib/market/types";
import type { Investigation } from "@/lib/ai/schema";
type Chat = { question: string; answer: Investigation };
const questions = ["Explain this order’s lifecycle.", "Were any fills counted twice?", "Why was this execution flagged?", "Which executions have the largest reference-price differences?", "What information is missing?", "What should an operator investigate next?"];
async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(45_000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}
const shortTime = (iso: string) => iso.slice(11, 23);
export default function Dashboard() {
  const [text, setText] = useState(samples[0].text);
  const [filename, setFilename] = useState("clean-demo.fix");
  const [sampleId, setSampleId] = useState("clean");
  const [report, setReport] = useState<Report | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const [selected, setSelected] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [provider, setProvider] = useState<"fixture" | "alpaca">("fixture");
  const [fillId, setFillId] = useState("");
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [question, setQuestion] = useState(questions[1]);
  const [token, setToken] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const order = report?.orders.find(o => o.id === selected) ?? report?.orders[0];
  const fills = order?.events.filter(e => e.execType === "F" && !e.duplicateOf && !e.disputed) ?? [];
  const activeFill = fills.find(e => e.sourceId === fillId) ?? fills[0];
  const stale = snapshot !== text;
  const ready = !!report && !stale && !busy;
  async function analyze(next = text, name = filename) {
    setBusy("Analyzing"); setError("");
    try { const result = await post<Report>("/api/analyze", { text: next, filename: name }); setReport(result); setSnapshot(next); setSelected(result.orders[0]?.id ?? ""); setSourceId(""); setFillId(""); setComparisons([]); setChats([]); }
    catch (e) { setError(e instanceof Error ? e.message : "Analysis failed."); }
    finally { setBusy(""); }
  }
  async function load(id: string) { const sample = samples.find(s => s.id === id)!; setSampleId(id); setText(sample.text); setFilename(`${id}-demo.fix`); await analyze(sample.text, `${id}-demo.fix`); }
  async function fault(kind: Fault) { const next = injectFault(text, kind); setText(next); await analyze(next); }
  function evidence(id: string) { setSourceId(id); requestAnimationFrame(() => document.getElementById(`source-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })); }
  async function market() {
    if (!activeFill) return;
    setBusy("Checking historical price"); setError("");
    try { const comparison = await post<Comparison>("/api/market", { text: snapshot, filename, sourceId: activeFill.sourceId, provider }); setComparisons(prev => [...prev.filter(c => c.sourceId !== comparison.sourceId || c.provider !== comparison.provider), comparison]); }
    catch (e) { setError(e instanceof Error ? e.message : "Historical data unavailable."); }
    finally { setBusy(""); }
  }
  async function ask() {
    setBusy("Investigating"); setError("");
    try { const answer = await post<Investigation>("/api/investigate", { text: snapshot, filename, question, orderId: order?.id, history: chats.slice(-3).map(c => ({ question: c.question, answer: c.answer })), marketRequests: comparisons.slice(-4).map(c => ({ sourceId: c.sourceId, provider: c.provider })) }, token); setChats(prev => [...prev.slice(-4), { question, answer }]); }
    catch (e) { setError(e instanceof Error ? e.message : "AI investigator unavailable."); }
    finally { setBusy(""); }
  }
  function exportReport() { const url = URL.createObjectURL(new Blob([JSON.stringify({ analysis: report, marketComparisons: comparisons }, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "hawkeye-incident.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function refs(ids: string[]) { return <span className="evidence-links">{ids.map(id => <button className="evidence" key={id} onClick={() => evidence(id)} title={id}>{report?.sources.find(s => s.id === id)?.filename}:{report?.sources.find(s => s.id === id)?.line}<ChevronRight size={11} /></button>)}</span>; }
  function finding(f: Finding, i: number) { return <article className={`finding ${f.severity}`} key={`${f.code}-${i}`}><span className="finding-code">{f.code.replaceAll("_", " ")}</span><p>{f.message}</p>{refs(f.sourceIds)}</article>; }
  return <div className="app-shell">
    <header className="topbar"><Link href="/" className="brand"><span className="brand-mark"><ScanSearch size={23} /></span><span>Hawkeye <span className="brand-divider">/</span> <strong>FIX Detective</strong></span></Link><span className="simulation"><span /> Simulated trading only</span><a className="subtle-link" href="#protocol"><CircleHelp size={16} /> Protocol & limits</a></header>
    <main className="workspace">
      <section className="page-heading"><div><p className="eyebrow">TRADING OPERATIONS / INVESTIGATION WORKSPACE</p><h1>Every execution. Every piece of evidence.</h1><p className="subtitle">Reconstruct the session, test the unexpected, and follow the facts.</p></div><button className="button secondary" onClick={exportReport} disabled={!ready}><ArrowDownToLine size={16} /> Export JSON</button></section>
      {error && <div className="error-banner" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError("")}><X size={16} /></button></div>}
      <section className="metrics" aria-label="Analysis summary">
        {[{ label: "MESSAGES INSPECTED", value: report?.summary.messages ?? "—", detail: "Original source retained", icon: FileText }, { label: "OBSERVED FILLED QTY", value: report?.summary.observedFilledQty ?? "—", detail: "Unique, undisputed fills only", icon: Activity }, { label: "DUPLICATE DELIVERIES", value: report?.summary.duplicateDeliveries ?? "—", detail: "Excluded from filled quantity", icon: Copy }, { label: "UNRESOLVED ORDERS", value: report?.summary.unresolvedOrders ?? "—", detail: "Evidence needs investigation", icon: Fingerprint }].map(m => <article className="metric" key={m.label}><div><p>{m.label}</p><m.icon size={17} /></div><strong data-testid={m.label === "OBSERVED FILLED QTY" ? "filled-total" : undefined}>{m.value}</strong><small>{m.detail}</small></article>)}
      </section>
      <div className="dashboard-grid"><div className="main-column">
        <section className="panel"><div className="panel-heading"><h2><FileText size={18} /> Session input</h2><span className="badge neutral">FIX 4.4 subset</span></div><div className="panel-body">
          <div className="input-toolbar"><label className="grow">Sample session<select aria-label="Sample session" value={sampleId} disabled={!!busy} onChange={e => { void load(e.target.value); }}>{samples.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label><button className="button secondary" disabled={!!busy} onClick={() => { void load("clean"); }}><FlaskConical size={15} /> Load clean sample</button><input ref={fileInput} className="sr-only" type="file" accept=".txt,.log,.fix" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 500_000) { setError("File exceeds the 500 KB limit."); return; } const name = file.name.replace(/[^\w. ()-]/g, "_").slice(0, 120); setFilename(name); setText(await file.text()); setSnapshot(""); }} /><button className="button secondary" disabled={!!busy} onClick={() => fileInput.current?.click()}><Upload size={15} /> Upload</button></div>
          <div className="editor-label"><span>{filename}</span><span>SOH or pipe-delimited demo · 500 KB / 2,000 lines max</span></div><textarea className="log-editor" aria-label="FIX messages" spellCheck={false} value={text} disabled={!!busy} onChange={e => setText(e.target.value)} />
          <div className="actions"><button className="button primary" disabled={!!busy || !text.trim()} onClick={() => { void analyze(); }}>{busy === "Analyzing" ? <LoaderCircle size={15} className="spin" /> : <Play size={15} />} Analyze</button><button className="button secondary" disabled={!!busy || !text} onClick={() => { void fault("duplicate"); }}><Copy size={14} /> Inject duplicate fill</button><button className="button secondary" disabled={!!busy || !text} onClick={() => { void fault("missing-ack"); }}>Remove acknowledgment</button><button className="button secondary" disabled={!!busy || !text} onClick={() => { void fault("shuffle"); }}><Shuffle size={14} /> Shuffle delivery</button><button className="icon-button" aria-label="Reset" title="Reset" disabled={!!busy} onClick={() => { void load(sampleId); }}><RotateCcw size={16} /></button></div>
          <p className="caption">{stale && report ? "Input changed. Analyze to update results and enable investigation actions." : "Analysis runs on the server. Repeated deliveries remain visible in the source evidence."}</p>
        </div></section>
        <section className="panel"><div className="panel-heading"><h2><Activity size={18} /> Order activity</h2><span className="caption">{report?.orders.length ?? 0} orders</span></div>{report?.orders.length ? <div className="table-scroll"><table><thead><tr><th>Order / symbol</th><th>Side</th><th>Filled / requested</th><th>Avg. fill price</th><th>State</th></tr></thead><tbody>{report.orders.map(o => <tr key={o.id} className={o.id === order?.id ? "selected-row" : ""}><td><button className="order-link" onClick={() => { setSelected(o.id); setFillId(""); }}>{o.label}<ArrowRight size={13} /></button><small>{o.symbol} · {JSON.parse(o.session)[1].join(" ↔ ")}</small></td><td><span className={`side ${o.side}`}>{o.side}</span></td><td className="mono">{o.filledQty} / {o.requestedQty ?? "?"}</td><td className="mono">{o.averagePrice ?? "—"}</td><td><span className={`badge ${o.reconciliation === "reconciled" ? "success" : "warning"}`}>{o.status}</span></td></tr>)}</tbody></table></div> : <div className="empty"><ScanSearch size={28} /><p>Load a sample or analyze a log to reconstruct its orders.</p></div>}</section>
        {order && <section className="panel"><div className="panel-heading"><h2>Event timeline <span className="caption">/ {order.label}</span></h2><span className="caption">UTC · evidence order</span></div><ol className="timeline">{order.events.map(e => <li key={e.sourceId} className={e.duplicateOf ? "duplicate-event" : ""}><span className="timeline-dot" /><time className="mono">{shortTime(e.timestamp)}</time><div><strong>{e.type === "request" ? "New order request" : e.type === "cancel-request" ? "Cancel requested — awaiting confirmation" : e.execType === "F" ? `Trade · ${e.lastQty} @ ${e.lastPx}` : e.execType === "0" ? "Order acknowledged" : e.execType === "4" ? "Cancellation confirmed" : "Order rejected"}</strong><p>{e.execId ?? e.clOrdId} · seq {e.sequence}{e.duplicateOf ? " · DUPLICATE — not counted" : e.disputed ? " · CONFLICT — excluded" : ""}</p>{refs([e.sourceId])}</div></li>)}</ol><div className="panel-footer"><ShieldCheck size={15} /> {order.reconciliation === "reconciled" ? "Reported quantities reconcile with the complete supported history." : "History is unresolved. Reported values are evidence, not a replacement for observed fills."}</div></section>}
        <section className="panel"><div className="panel-heading"><h2><Fingerprint size={18} /> Source evidence</h2><span className="caption">Exact fields · original line references</span></div><div className="sources">{report?.sources.map(s => <details key={s.id} id={`source-${s.id}`} open={sourceId === s.id} onToggle={e => { if (e.currentTarget.open && sourceId !== s.id) setSourceId(s.id); }}><summary><span><FileText size={14} /> {s.filename}:{s.line}</span><span className="source-id">{s.id} · {s.delimiter}</span></summary><div className="source-detail"><code>{s.raw.replaceAll("\x01", "␁")}</code><div className="field-list">{s.fields.map((f, i) => <span key={i}><b>{f.tag}</b> {f.value}</span>)}</div></div></details>) ?? <p className="caption">Source messages will appear after analysis.</p>}</div></section>
      </div><aside className="side-column">
        <section className="panel"><div className="panel-heading"><h2><ShieldCheck size={18} /> Findings</h2><span className="badge neutral">{report?.findings.length ?? 0}</span></div><div className="findings">{report ? report.findings.length ? report.findings.filter(f => !f.orderId || f.orderId === order?.id).map(finding) : <div className="healthy"><Check size={22} /><strong>No anomalies in supported evidence</strong><p>Try injecting a duplicate fill. The observed quantity should stay the same.</p></div> : <p className="caption">Analyze a session to review anomalies and unresolved evidence.</p>}</div></section>
        <section className="panel"><div className="panel-heading"><h2><Activity size={18} /> Historical price context</h2></div><div className="panel-body stack"><p className="caption">Compare a unique execution with the last completed minute bar. Approximate context, not execution-quality proof.</p><label>Execution<select aria-label="Execution" value={activeFill?.sourceId ?? ""} onChange={e => setFillId(e.target.value)} disabled={!fills.length || !!busy}>{!fills.length && <option value="">No execution selected</option>}{fills.map(e => <option key={e.sourceId} value={e.sourceId}>{shortTime(e.timestamp)} · {e.lastQty} @ {e.lastPx}</option>)}</select></label><label>Data source<select aria-label="Data source" value={provider} onChange={e => setProvider(e.target.value as "fixture" | "alpaca")}><option value="fixture">Fixture · synthetic demonstration prices</option><option value="alpaca">Alpaca · external IEX feed</option></select></label><button className="button secondary full" disabled={!ready || !activeFill} onClick={() => { void market(); }}>Check execution price <ArrowRight size={15} /></button>{comparisons.filter(c => c.orderId === order?.id).map((c, i) => <article className="market-card" key={i}><span className={`badge ${c.provider === "fixture" ? "warning" : "success"}`}>{c.provider === "fixture" ? "SYNTHETIC FIXTURE" : "EXTERNAL ALPACA"} · {c.feed}</span><strong>{c.adverseBps} bps <small>side-aware adverse difference</small></strong><p>{c.symbol} {c.side} · execution {c.executionPrice} / reference {c.referencePrice}</p><dl><dt>Execution (UTC)</dt><dd>{c.executionTimestamp}</dd><dt>Bar start (UTC)</dt><dd>{c.referenceTimestamp}</dd><dt>Bar close available (UTC)</dt><dd>{c.referenceEndTimestamp}</dd><dt>Distance from bar close</dt><dd>{c.distanceMs / 1000}s</dd><dt>Reference</dt><dd>{c.referenceType} · {c.method}</dd></dl><p className={c.flagged ? "review-flag" : "caption"}>{c.flagged ? "Review threshold exceeded (25 bps)." : "Within the 25 bps review threshold."}</p><p className="caption">{c.limitations.join(" ")}</p>{refs([c.sourceId])}</article>)}</div></section>
        <section className="panel ai-panel"><div className="panel-heading"><h2><Sparkles size={18} /> AI investigator</h2><span className="badge neutral">Evidence-linked</span></div><div className="panel-body stack"><p className="caption">Live AI requires configured Gateway access and an investigator access code. Your input and server-recomputed evidence are sent to the configured model.</p><label>Investigator access code<input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} placeholder="Provided by the demo operator" /></label><div className="suggestions">{questions.map(q => <button key={q} onClick={() => setQuestion(q)}>{q}</button>)}</div>{chats.map((chat, i) => <div className="chat" key={i}><p className="chat-question"><MessageSquare size={14} /> {chat.question}</p>{chat.answer.sections.map((section, j) => <div key={j}><h3>{section.category}</h3>{section.claims.map((claim, k) => <div key={k}><p>{claim.text}</p>{refs(claim.sourceIds)}</div>)}</div>)}<small>Citation IDs checked. This does not prove every AI statement is supported.</small></div>)}<label htmlFor="question">Investigation question</label><textarea id="question" className="question-input" maxLength={1200} value={question} onChange={e => setQuestion(e.target.value)} /><button className="button primary full" disabled={!ready || !question.trim()} onClick={() => { void ask(); }}>{busy === "Investigating" ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />} Ask AI</button><p className="caption">AI explains evidence. It cannot change totals or place orders.</p></div></section>
      </aside></div>
      <footer id="protocol"><ShieldCheck size={17} /><p><strong>Evidence has boundaries.</strong> FIX 4.4 subset only. BodyLength and CheckSum are not validated; pipe input is a demo representation. Unsupported messages remain visible and make reconciliation unresolved. No database, accounts, or real order execution.</p><span>HAWKEYE / FIX DETECTIVE</span></footer>
      <div className="sr-only" role="status" aria-live="polite">{busy || (report ? `Analysis complete. ${report.summary.observedFilledQty} observed filled quantity.` : "Ready to analyze")}</div>
    </main></div>;
}
