"use client";
import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronRight,
  RefreshCw,
  Wallet,
} from "lucide-react";
import type { HoldingsResponse, PricePoint } from "@/lib/holdings/types";

const money = (value: string | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(Number(value));
const date = (value: string | null | undefined) =>
  value
    ? new Date(value)
        .toISOString()
        .replace("T", " ")
        .replace(".000Z", "Z")
        .replace("Z", " UTC")
    : "Unavailable";
const signClass = (value: string | null | undefined) =>
  value == null ? "" : Number(value) < 0 ? "loss" : "gain";
function Return({
  value,
  percent,
}: {
  value: string | null | undefined;
  percent?: string | null;
}) {
  if (value == null) return <span className="muted">Incomplete</span>;
  const negative = Number(value) < 0;
  return (
    <span className={signClass(value)}>
      {negative ? "Loss" : "Gain"} {money(value)}
      {percent != null ? ` (${Number(percent).toFixed(2)}%)` : ""}
    </span>
  );
}
export function PriceChart({
  points,
  small = false,
  symbol,
}: {
  points: PricePoint[];
  small?: boolean;
  symbol: string;
}) {
  if (points.length < 2)
    return (
      <div className={small ? "spark-empty" : "chart-empty"}>
        {small ? (
          "—"
        ) : (
          <>
            <ChartNoAxesCombined size={32} />
            <p>Price history will appear here</p>
            <small>
              Refresh available prices or select synthetic fixture data.
            </small>
          </>
        )}
      </div>
    );
  const values = points.map((p) => Number(p.price)),
    min = Math.min(...values),
    max = Math.max(...values),
    span = max - min || 1;
  const width = 600,
    height = small ? 80 : 240,
    pad = small ? 5 : 22;
  const coordinates = values.map(
    (v, i) =>
      `${pad + (i * (width - pad * 2)) / (values.length - 1)},${height - pad - ((v - min) / span) * (height - pad * 2)}`,
  );
  const gain = values.at(-1)! >= values[0];
  return (
    <svg
      className={small ? "sparkline" : "price-chart"}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={small ? "none" : "xMidYMid meet"}
      role="img"
      aria-label={`${symbol} ${points.length} available price observations, ${date(points[0].timestamp)} to ${date(points.at(-1)!.timestamp)}; ${gain ? "rising" : "falling"}`}
    >
      {!small &&
        [0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="20"
              x2="580"
              y1={22 + i * 65}
              y2={22 + i * 65}
              stroke="currentColor"
              strokeDasharray="3 5"
              opacity=".12"
            />
            <text
              x="578"
              y={18 + i * 65}
              textAnchor="end"
              fill="currentColor"
              opacity=".65"
              fontSize="10"
            >
              {(max - (i * span) / 3).toFixed(2)}
            </text>
          </g>
        ))}
      {!small && (
        <polygon
          points={`${pad},${height - pad} ${coordinates.join(" ")} ${width - pad},${height - pad}`}
          fill={gain ? "#b4ef3210" : "#ff797910"}
        />
      )}
      <polyline
        points={coordinates.join(" ")}
        fill="none"
        stroke={gain ? "#b4ef32" : "#ff7979"}
        strokeWidth={small ? 3 : 2}
        vectorEffect="non-scaling-stroke"
      />
      {!small && (
        <circle
          cx={width - pad}
          cy={coordinates.at(-1)!.split(",")[1]}
          r="4"
          fill={gain ? "#b4ef32" : "#ff7979"}
        />
      )}
    </svg>
  );
}
export default function HoldingsOverview({
  data,
  ready,
  busy,
  provider,
  zero,
  onProvider,
  onZero,
  onRefresh,
  onEvidence,
}: {
  data: HoldingsResponse | null;
  ready: boolean;
  busy: boolean;
  provider: "fixture" | "alpaca";
  zero: boolean;
  onProvider: (v: "fixture" | "alpaca") => void;
  onZero: (v: boolean) => void;
  onRefresh: () => void;
  onEvidence: (id: string) => void;
}) {
  const [selection, setSelection] = useState("");
  const holding =
    data?.holdings.find((h) => h.id === selection) ?? data?.holdings[0];
  const market = holding?.market;
  const ageMinutes =
    market?.timestamp && data?.retrievedAt
      ? Math.max(
          0,
          Math.floor(
            (Date.parse(data.retrievedAt) - Date.parse(market.timestamp)) /
              60000,
          ),
        )
      : null;
  return (
    <section
      id="holdings"
      className="holdings-workspace"
      aria-label="Holdings Overview"
    >
      <article className="panel portfolio-card">
        <div className="panel-heading">
          <h2>
            <Wallet size={16} /> Portfolio overview
          </h2>
          <span className="status-dot" />
        </div>
        <div className="panel-body">
          <p className="overline">SIMULATED PORTFOLIO · USD</p>
          <div className="portfolio-total" data-testid="portfolio-value">
            {money(data?.summary.marketValue)}
          </div>
          <div className="portfolio-return">
            <Return
              value={data?.summary.unrealizedPnl}
              percent={data?.summary.unrealizedPercent}
            />
          </div>
          <p className="caption">
            Unrealized return • available price snapshot
          </p>
          <div className="portfolio-rule" />
          <dl className="portfolio-stats">
            <dt>Observed books / symbols</dt>
            <dd>{data?.holdings.length ?? "—"}</dd>
            <dt>Accounting</dt>
            <dd>Weighted average</dd>
            <dt>Reconciliation</dt>
            <dd className={data?.summary.complete ? "gain" : "caution"}>
              {data?.summary.complete ? "Complete" : "Incomplete"}
            </dd>
          </dl>
          <label className="opening-toggle">
            <input
              type="checkbox"
              checked={zero}
              disabled={!ready || busy}
              onChange={(e) => onZero(e.target.checked)}
            />
            <span>
              I confirm this is the complete history with zero opening positions
              in every session.
            </span>
          </label>
          <p className="caption">
            Totals are withheld if positions, cost basis or prices are
            incomplete. No real holdings or funds.
          </p>
        </div>
      </article>
      <article className="panel chart-panel">
        <div className="panel-heading">
          <h2>
            <span className="widget-square" />
            {holding?.symbol ?? "Market overview"}
            <span className="caption">/ Available price history</span>
          </h2>
          <ChartNoAxesCombined size={17} />
        </div>
        <div className="chart-toolbar">
          <label>
            Holdings price source
            <select
              aria-label="Holdings price source"
              value={provider}
              onChange={(e) =>
                onProvider(e.target.value as "fixture" | "alpaca")
              }
              disabled={busy}
            >
              <option value="fixture">Synthetic fixture</option>
              <option value="alpaca">Alpaca · IEX</option>
            </select>
          </label>
          <button
            className="button secondary"
            onClick={onRefresh}
            disabled={!ready || busy}
          >
            <RefreshCw size={14} className={busy ? "spin" : ""} />
            {busy ? "Refreshing…" : "Refresh prices"}
          </button>
        </div>
        <div className="chart-quote">
          <div>
            <strong>{money(market?.price)}</strong>
            <span className="badge neutral">
              {market?.provider === "fixture"
                ? "FIXTURE · NOT LIVE"
                : market
                  ? "IEX · NOT LIVE STREAM"
                  : "NO PRICE SNAPSHOT"}
            </span>
          </div>
          <p className="caption">Price as of {date(market?.timestamp)}</p>
          {market?.provider === "alpaca" && ageMinutes !== null && (
            <p className={`caption ${ageMinutes >= 15 ? "caution" : ""}`}>
              {ageMinutes >= 15
                ? "Delayed / stale snapshot"
                : "Recent snapshot"}{" "}
              ·{" "}
              {ageMinutes >= 1440
                ? `${Math.floor(ageMinutes / 1440)} days`
                : `${ageMinutes} minutes`}{" "}
              old at retrieval
            </p>
          )}
        </div>
        <PriceChart
          points={market?.history ?? []}
          symbol={holding?.symbol ?? "Selected symbol"}
        />
        <div className="chart-axis">
          <span>
            {market?.history[0]?.timestamp.slice(0, 10) ?? "No history"}
          </span>
          <span>{market?.history.at(-1)?.timestamp.slice(0, 10) ?? ""}</span>
        </div>
        <div className="chart-legend">
          <span className="chart-range">
            {market?.provider === "fixture"
              ? "FIXTURE HISTORY"
              : "AVAILABLE DAILY BARS"}
          </span>
          <span>Unadjusted · USD</span>
          <span>Line: closing price</span>
        </div>
        <div className="position-stat-row">
          <div>
            <span>Net observed shares</span>
            <strong>{holding?.netQuantity ?? "—"}</strong>
          </div>
          <div>
            <span>Avg. cost basis</span>
            <strong>{money(holding?.averageCost)}</strong>
          </div>
          <div>
            <span>Market value</span>
            <strong>{money(holding?.marketValue)}</strong>
          </div>
          <div>
            <span>Unrealized P/L</span>
            <strong>
              <Return
                value={holding?.unrealizedPnl}
                percent={holding?.unrealizedPercent}
              />
            </strong>
          </div>
        </div>
        <div className="panel-footer price-disclosure">
          <span>
            {market?.limitations.join(" ") ??
              "Latest-price snapshots are separate from historical execution-price comparisons."}
            <br />
            Last retrieved: {date(data?.retrievedAt)}
          </span>
        </div>
        {data?.priceError && (
          <div className="holdings-error" role="alert">
            {data.priceError}
          </div>
        )}
      </article>
      <article className="panel positions-panel">
        <div className="panel-heading">
          <h2>Holdings Overview</h2>
          <span className="badge neutral">
            {data?.holdings.length ?? 0} positions
          </span>
        </div>
        <div className="position-list">
          {!data?.holdings.length ? (
            <div className="empty">
              <ChartNoAxesCombined size={25} />
              <p>
                Analyze a session to see acquired shares and supported sells.
              </p>
            </div>
          ) : (
            data.holdings.map((h) => (
              <div
                key={h.id}
                className={`position-entry ${h.id === holding?.id ? "active-position" : ""}`}
              >
                <button
                  className="position-select"
                  onClick={() => setSelection(h.id)}
                  aria-pressed={h.id === holding?.id}
                  aria-label={`View ${h.symbol} holding`}
                >
                  <span className="ticker-icon">{h.symbol.slice(0, 1)}</span>
                  <span>
                    <b>{h.symbol}</b>
                    <small>{h.netQuantity} net shares</small>
                  </span>
                  <PriceChart
                    points={h.market?.history ?? []}
                    small
                    symbol={h.symbol}
                  />
                  <ChevronRight size={14} />
                </button>
                <table
                  className="holding-values"
                  aria-label={`${h.symbol} holding valuation`}
                >
                  <tbody>
                    <tr>
                      <th scope="row">Avg. cost</th>
                      <td>{money(h.averageCost)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Latest available</th>
                      <td>{money(h.market?.price)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Market value</th>
                      <td>{money(h.marketValue)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Unrealized P/L</th>
                      <td>
                        <Return
                          value={h.unrealizedPnl}
                          percent={h.unrealizedPercent}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="caption">
                  {h.market?.provider === "fixture"
                    ? "Synthetic fixture"
                    : h.market
                      ? "Alpaca IEX"
                      : "No prices"}{" "}
                  · {date(h.market?.timestamp)}
                </p>
                <p className="book-label">
                  Book: {JSON.parse(h.session)[1].join(" ↔ ")} ·{" "}
                  {JSON.parse(h.session)[2]}
                </p>
                {h.reasons.length > 0 && (
                  <details className="holding-limit">
                    <summary>
                      <span className="caution">Incomplete evidence</span>
                    </summary>
                    {h.reasons.map((r) => (
                      <p className="caption" key={r}>
                        {r}
                      </p>
                    ))}
                  </details>
                )}
                {h.market?.error && (
                  <p className="caution caption">{h.market.error}</p>
                )}
                <button
                  className="position-evidence"
                  disabled={!h.sourceIds.length}
                  onClick={() => onEvidence(h.sourceIds[0])}
                >
                  View execution evidence <ChevronRight size={12} />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="panel-footer">
          {holding?.unrealizedPnl && Number(holding.unrealizedPnl) < 0 ? (
            <ArrowDownRight size={14} />
          ) : (
            <ArrowUpRight size={14} />
          )}
          Only unique, undisputed executions count. Requests and cancellations
          never purchase shares.
        </div>
      </article>
    </section>
  );
}
