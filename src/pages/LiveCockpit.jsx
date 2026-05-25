import { useMemo, useState, useEffect, useRef } from "react";
import { TrendingUp, Activity, Brain, Waves, Eye, Zap } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { useEngineData } from "../hooks/useEngineData";

// No more hardcoded fallback — viewer mode uses real data from /market

const STATS_INITIAL = [
  { label: "Today's profit",    value: "$0.00",    sub: "Last 24h",         color: "var(--text2)",  accent: "var(--green)" },
  { label: "AI confidence",     value: "0%",       sub: "Current signal",   color: "var(--text2)",  accent: "var(--v)" },
  { label: "Trades today",      value: "0",        sub: "Win rate: 0%",     color: "var(--text2)",  accent: "var(--cyan)" },
  { label: "Safety score",      value: "100/100",  sub: "Current pair",     color: "var(--text2)",  accent: "var(--gold)" },
];

function formatTime(ts) {
  if (!ts) return "--:--:--";
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour12: false });
}

// Production Arbitrage Phase 4: render the cycle path generically when present
// (e.g. "fUSDC → fSOL → fRAY → fUSDC" for any hop count), fall back to the
// legacy `pair` field otherwise. Also surface reasonCode for failed trades.
function pathLabel(t) {
  if (Array.isArray(t.cyclePath) && t.cyclePath.length > 0) {
    return t.cyclePath.join(" → ");
  }
  return t.pair || "unknown";
}

function reasonLabel(t) {
  if (t.reason) return t.reason;
  if (t.reasonCode) return t.reasonCode;
  return "unknown";
}

function tickToFeedItem(tick) {
  if (!tick) return null;
  const t = tick;
  if (t.type === "opportunity_found") {
    return { msg: `Opportunity: ${pathLabel(t)} ${t.profit ? `est. +$${t.profit.toFixed(4)}` : ""}`, color: "var(--green)", time: formatTime(t.timestamp) };
  }
  if (t.type === "safety_rejected") {
    return { msg: `Safety rejected: ${reasonLabel(t)}`, color: "var(--red)", time: formatTime(t.timestamp) };
  }
  if (t.type === "trade_executed") {
    const hops = t.hops ? ` (${t.hops} hops)` : "";
    return { msg: `Trade executed: ${pathLabel(t)}${hops} — profit: ${t.profit ? `+$${t.profit.toFixed(4)}` : "$0"}`, color: "var(--green)", time: formatTime(t.timestamp) };
  }
  if (t.type === "protection_blocked") {
    return { msg: `Protection blocked: ${reasonLabel(t)}`, color: "var(--gold)", time: formatTime(t.timestamp) };
  }
  if (t.type === "trade_rejected") {
    // Phase 4: explicit failure with reasonCode (preflight_sim_failed, fee_guard,
    // tx_rejected, etc.) so the user knows WHY a tick failed.
    const code = t.reasonCode ? ` [${t.reasonCode}]` : "";
    return { msg: `Trade rejected${code}: ${pathLabel(t)} — ${reasonLabel(t)}`, color: "var(--red)", time: formatTime(t.timestamp) };
  }
  if (t.type === "scan_complete") {
    return { msg: `Scan: ${t.poolsScanned || 0} pools, ${t.opportunitiesFound || 0} opportunities`, color: "var(--text2)", time: formatTime(t.timestamp) };
  }
  return { msg: t.message || `Tick: ${t.type || "update"}`, color: "var(--text2)", time: formatTime(t.timestamp) };
}

// ── Opportunities table (viewer mode) ──────────────────────

function OpportunitiesPanel({ market }) {
  if (!market || !market.opportunities || market.opportunities.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text3)", fontSize: 13 }}>
        Scanning for opportunities...
      </div>
    );
  }

  const typeColors = {
    arbitrage:        "var(--cyan)",
    yield:            "var(--v2)",
    liquidation:      "var(--gold)",
    directional:      "var(--green)",
    chart_pattern:    "var(--v2)",       // purple — AI chart
    social_buzz:      "var(--cyan)",     // cyan — social
    copy_whale:       "var(--pink)",     // pink — whale
    mempool_pressure: "var(--green)",    // green — live flow
  };

  const typeBg = {
    arbitrage:        "rgba(34,211,238,.08)",
    yield:            "rgba(139,92,246,.08)",
    liquidation:      "rgba(234,179,8,.08)",
    directional:      "rgba(34,197,94,.08)",
    chart_pattern:    "rgba(124,58,237,.10)",
    social_buzz:      "rgba(0,212,255,.10)",
    copy_whale:       "rgba(236,72,153,.10)",
    mempool_pressure: "rgba(16,185,129,.10)",
  };

  const typeLabels = {
    arbitrage:        "ARB",
    yield:            "YIELD",
    liquidation:      "LIQ",
    directional:      "AI",
    chart_pattern:    "CHART",
    social_buzz:      "BUZZ",
    copy_whale:       "WHALE",
    mempool_pressure: "FLOW",
  };

  const typeIcons = {
    arbitrage:        "⚡",
    yield:            "📈",
    liquidation:      "💰",
    directional:      "🤖",
    chart_pattern:    "📊",
    social_buzz:      "🔥",
    copy_whale:       "🐋",
    mempool_pressure: "🌊",
  };

  return (
    <div style={{ position: "absolute", inset: 0, overflowY: "auto", padding: "8px 0" }}>
      {market.opportunities.map((opp, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "auto 1fr auto auto",
          gap: 20, alignItems: "center", padding: "18px 24px",
          borderBottom: "1px solid var(--border)",
        }}>
          {/* Type badge */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 12, fontWeight: 800, textTransform: "uppercase",
            padding: "6px 14px", borderRadius: 8, letterSpacing: ".8px",
            color: typeColors[opp.type] || "var(--text2)",
            background: typeBg[opp.type] || "var(--bg3)",
          }}>
            <span style={{ fontSize: 13 }}>{typeIcons[opp.type] || "•"}</span>
            {typeLabels[opp.type] || (opp.type || "?").toUpperCase()}
          </span>

          {/* Path */}
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>
              {opp.path}
            </div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
              {opp.tokenIn} → {opp.tokenOut} · {opp.pools.join(" → ")}
            </div>
          </div>

          {/* Amount */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".5px" }}>Input</div>
            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Space Mono',monospace", color: "var(--text2)", marginTop: 3 }}>
              ${opp.amountIn.toFixed(0)}
            </div>
          </div>

          {/* Profit */}
          <div style={{ textAlign: "right", minWidth: 100 }}>
            <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".5px" }}>Est. profit</div>
            <div style={{
              fontSize: 18, fontWeight: 900, fontFamily: "'Space Mono',monospace", marginTop: 3,
              color: opp.estimatedProfit > 0 ? "var(--green)" : "var(--red)",
            }}>
              {opp.estimatedProfit >= 0 ? "+" : ""}${opp.estimatedProfit.toFixed(4)}
            </div>
            {opp.profitPercent > 0 && (
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                {opp.profitPercent.toFixed(2)}%
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Pool states panel (viewer mode bottom) ─────────────────

function PoolStatsStrip({ market }) {
  if (!market || !market.pools || market.pools.length === 0) {
    return (
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        gap: 1, borderTop: "1px solid var(--border)", flexShrink: 0,
      }}>
        {["Pool data", "Reserves", "TVL"].map((label, i) => (
          <div key={i} style={{ padding: "12px 16px", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
            <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text3)", fontFamily: "'Space Mono',monospace" }}>Loading...</div>
          </div>
        ))}
      </div>
    );
  }

  const totalTvl = market.pools.reduce((s, p) => s + p.tvl, 0);
  const totalOpps = market.opportunities?.length || 0;
  const profitableOpps = (market.opportunities || []).filter(o => o.estimatedProfit > 0).length;

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      gap: 1, borderTop: "1px solid var(--border)", flexShrink: 0,
    }}>
      <div style={{ padding: "12px 16px", borderRight: "1px solid var(--border)" }}>
        <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 4 }}>Pools monitored</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--cyan)", fontFamily: "'Space Mono',monospace" }}>
          {market.pools.length} active
        </div>
      </div>
      <div style={{ padding: "12px 16px", borderRight: "1px solid var(--border)" }}>
        <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 4 }}>Total TVL</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", fontFamily: "'Space Mono',monospace" }}>
          ${totalTvl.toFixed(0)}
        </div>
      </div>
      <div style={{ padding: "12px 16px" }}>
        <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 4 }}>Opportunities</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: profitableOpps > 0 ? "var(--green)" : "var(--text3)", fontFamily: "'Space Mono',monospace" }}>
          {profitableOpps}/{totalOpps} profitable
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────

export default function LiveCockpit({ browse, running, userId }) {
  // browse = no wallet → viewer mode with real market data
  // userId = wallet connected → user engine (active or viewer based on config)
  const { status, ticks, trades, market, connected } = useEngineData(
    browse ? null : userId,
    { viewer: browse },
  );

  const isViewer = browse || status?.mode === "viewer";

  // Real-time PnL chart data (active mode only).
  // Uses vaultProfit (on-chain ground truth: balance - deposits + withdrawals)
  // and shows the delta from the value at session start so the chart begins at 0.
  const [pnlHistory, setPnlHistory] = useState([{ time: "", pnl: 0 }]);
  const sessionBaseRef = useRef(null); // vaultProfit at session start

  useEffect(() => {
    if (browse || isViewer) return;
    // Prefer vaultProfit when vault is funded (on-chain ground truth).
    // Fall back to in-memory dailyPnl otherwise.
    // NOTE: vaultProfit can be 0 (numeric) when vault has no balance — use vaultBalance
    // to distinguish "vault has 0 profit" from "vault not funded, use dailyPnl".
    const rawPnl = (status?.vaultExists && (status?.vaultBalance ?? 0) > 0)
      ? status.vaultProfit
      : (status?.dailyPnl ?? null);
    if (rawPnl == null) return;
    // Anchor baseline on first non-null value so chart starts at 0.
    if (sessionBaseRef.current === null) sessionBaseRef.current = rawPnl;
    const pnl = parseFloat((rawPnl - sessionBaseRef.current).toFixed(6));
    setPnlHistory(prev => {
      const now = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
      const last = prev[prev.length - 1];
      if (last && last.pnl === pnl && prev.length > 1) return prev;
      return [...prev.slice(-59), { time: now, pnl }];
    });
  }, [status?.vaultProfit, status?.dailyPnl, browse, isViewer]);

  // Build KPI stats
  const hasRealData = status != null && status.running === true && (status.vaultProfit !== undefined || status.dailyPnl !== undefined);

  const stats = useMemo(() => {
    // Viewer mode (browse or config): show market-focused KPIs
    if (isViewer && market) {
      const totalOpps = market.opportunities?.length || 0;
      const profitableOpps = (market.opportunities || []).filter(o => o.estimatedProfit > 0);
      const bestProfit = profitableOpps.length > 0
        ? Math.max(...profitableOpps.map(o => o.estimatedProfit))
        : 0;
      return [
        {
          label: "Opportunities",
          value: `${totalOpps}`,
          sub: `${profitableOpps.length} profitable`,
          color: totalOpps > 0 ? "var(--cyan)" : "var(--text2)",
          accent: "var(--cyan)",
        },
        {
          label: "Best spread",
          value: bestProfit > 0 ? `+$${bestProfit.toFixed(4)}` : "$0.00",
          sub: "Highest est. profit",
          color: bestProfit > 0 ? "var(--green)" : "var(--text2)",
          accent: "var(--green)",
        },
        {
          label: "Pools active",
          value: `${market.pools?.length || 0}`,
          sub: "Being monitored",
          color: "var(--v2)",
          accent: "var(--v)",
        },
        {
          label: "AI confidence",
          value: status?.aiConfidence != null ? `${Math.round(status.aiConfidence * 100)}%` : "---",
          sub: "Current signal",
          color: "var(--gold)",
          accent: "var(--gold)",
        },
      ];
    }

    // Viewer with no market data yet, or inactive engine
    if (isViewer) return STATS_INITIAL;
    if (!hasRealData) return STATS_INITIAL;

    // Active mode: trading KPIs
    return [
      {
        label: "Today's profit",
        value: (() => {
          const p = (status.vaultExists && (status.vaultBalance ?? 0) > 0)
            ? status.vaultProfit
            : status.dailyPnl;
          return p != null ? `${p >= 0 ? "+" : ""}$${Math.abs(p).toFixed(2)}` : "$0.00";
        })(),
        sub: status.vaultExists && (status.vaultBalance ?? 0) > 0 ? "Vault profit" : "Session PnL",
        color: ((status.vaultExists && (status.vaultBalance ?? 0) > 0 ? status.vaultProfit : status.dailyPnl) || 0) >= 0 ? "var(--green)" : "var(--red)",
        accent: ((status.vaultExists && (status.vaultBalance ?? 0) > 0 ? status.vaultProfit : status.dailyPnl) || 0) >= 0 ? "var(--green)" : "var(--red)",
      },
      {
        label: "AI confidence",
        value: status.aiConfidence != null ? `${Math.round(status.aiConfidence * 100)}%` : "0%",
        sub: "Current signal",
        color: "var(--v2)",
        accent: "var(--v)",
      },
      {
        label: "Trades today",
        value: status.tradesToday != null ? `${status.tradesToday}` : "0",
        sub: status.winRate != null ? `Win rate: ${Math.round(status.winRate * 100)}%` : "Win rate: 0%",
        color: "var(--cyan)",
        accent: "var(--cyan)",
      },
      {
        label: "Safety score",
        value: status.safetyScore != null ? `${status.safetyScore}/100` : "100/100",
        sub: "Current pair",
        color: "var(--gold)",
        accent: "var(--gold)",
      },
    ];
  }, [status, browse, hasRealData, isViewer, market]);

  // Build feed from real ticks or fallback
  const feedItems = useMemo(() => {
    if (ticks.length === 0) return [];
    return ticks
      .slice()
      .reverse()
      .map(tickToFeedItem)
      .filter(Boolean);
  }, [ticks]);

  // Signal cards from real status
  const signals = useMemo(() => {
    if (!hasRealData && !isViewer) {
      return [
        { icon: Brain, label: "AI signal", val: "---", color: "var(--text3)", bg: "var(--bg3)" },
        { icon: Waves, label: "Sentiment", val: "---", color: "var(--text3)", bg: "var(--bg3)" },
        { icon: TrendingUp, label: "Regime", val: "---", color: "var(--text3)", bg: "var(--bg3)" },
        { icon: Activity, label: "Volatility", val: "---", color: "var(--text3)", bg: "var(--bg3)" },
      ];
    }
    const s = status || {};
    return [
      {
        icon: Brain, label: "AI signal",
        val: s.aiDirection || "---",
        color: s.aiDirection === "bullish" ? "var(--green)" : s.aiDirection === "bearish" ? "var(--red)" : "var(--text2)",
        bg: s.aiDirection === "bullish" ? "var(--green2)" : s.aiDirection === "bearish" ? "var(--red2, rgba(239,68,68,.1))" : "var(--bg3)",
      },
      {
        icon: Waves, label: "Sentiment",
        val: s.sentiment || "---",
        color: s.sentiment === "positive" ? "var(--green)" : s.sentiment === "negative" ? "var(--red)" : "var(--gold)",
        bg: s.sentiment === "positive" ? "var(--green2)" : s.sentiment === "negative" ? "var(--red2, rgba(239,68,68,.1))" : "var(--gold2)",
      },
      {
        icon: TrendingUp, label: "Regime",
        val: s.regime || "---",
        color: s.regime === "trending" ? "var(--v2)" : s.regime === "crash" ? "var(--red)" : "var(--text2)",
        bg: s.regime === "trending" ? "var(--v3)" : s.regime === "crash" ? "var(--red2, rgba(239,68,68,.1))" : "var(--bg3)",
      },
      {
        icon: Activity, label: "Volatility",
        val: s.volatility || "---",
        color: s.volatility === "high" ? "var(--red)" : s.volatility === "low" ? "var(--green)" : "var(--cyan)",
        bg: s.volatility === "high" ? "var(--red2, rgba(239,68,68,.1))" : s.volatility === "low" ? "var(--green2)" : "var(--cyan2)",
      },
    ];
  }, [status, browse, hasRealData, isViewer]);

  // Bottom strip info
  const bottomInfo = useMemo(() => {
    if (!hasRealData && !isViewer) {
      return [
        { label: "Market trend", val: "---", color: "var(--text3)" },
        { label: "Whale activity", val: "---", color: "var(--text3)" },
        { label: "Today's loss limit", val: "$0 / $500", color: "var(--text2)" },
      ];
    }
    return [
      {
        label: "Market trend",
        val: status?.regime === "trending" ? "Trending ↑" : status?.regime === "crash" ? "Crash ↓" : "Ranging →",
        color: status?.regime === "trending" ? "var(--green)" : status?.regime === "crash" ? "var(--red)" : "var(--text2)",
      },
      {
        label: "Whale activity",
        val: status?.whaleActivity || "---",
        color: "var(--gold)",
      },
      {
        label: isViewer ? "Mode" : "Today's loss limit",
        val: isViewer ? "Viewer — watch only"
          : status?.drawdownUsed != null ? `-$${Math.abs(status.drawdownUsed).toFixed(0)} / $${status.drawdownLimit || 500}`
          : "$0 / $500",
        color: isViewer ? "var(--cyan)" : "var(--text2)",
      },
    ];
  }, [status, browse, hasRealData, isViewer]);

  // Chart PnL display — prefer vault profit only when vault is funded.
  const currentPnl = (status?.vaultExists && (status?.vaultBalance ?? 0) > 0)
    ? (status?.vaultProfit ?? 0)
    : (status?.dailyPnl ?? 0);
  const pnlColor = currentPnl >= 0 ? "var(--green)" : "var(--red)";

  return (
    <div className="cockpit">
      {/* KPI row */}
      <div className="cockpit-top">
        {stats.map((s, i) => (
          <div
            key={i}
            className="stat-card"
            style={{ "--accent-color": s.accent }}
          >
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
            {running && !isViewer && i === 0 && (
              <div className="stat-badge" style={{ background: "var(--green2)", color: "var(--green)" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", animation: "pulse 1.5s infinite" }} />
                {connected ? "Live" : "Connecting..."}
              </div>
            )}
            {running && isViewer && i === 0 && (
              <div className="stat-badge" style={{ background: "var(--cyan2, rgba(34,211,238,.1))", color: "var(--cyan)" }}>
                <Eye size={10} />
                {connected ? "Watching" : "Connecting..."}
              </div>
            )}
            {browse && !running && i === 0 && (
              <div className="stat-badge" style={{ background: "var(--cyan2, rgba(34,211,238,.1))", color: "var(--cyan)" }}>
                <Eye size={10} />
                {connected ? "Watching" : "Connecting..."}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Main row */}
      <div className="cockpit-main">
        {/* Chart / Opportunities panel */}
        <div className="chart-panel">
          <div className="chart-header">
            <div>
              {isViewer ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="chart-symbol">Live Opportunities</span>
                    <span style={{ fontSize: 12, color: "var(--cyan)", fontWeight: 700 }}>
                      {market?.opportunities?.length || 0} found
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4, fontFamily: "'Space Mono',monospace" }}>
                    Real-time on-chain pool scanning · updated every tick
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="chart-symbol">Session PnL</span>
                    <span className="chart-price" style={{ color: pnlColor }}>
                      {currentPnl >= 0 ? "+" : ""}${Math.abs(currentPnl).toFixed(6)}
                    </span>
                    <span className={`chart-change ${currentPnl >= 0 ? "up" : "dn"}`}>
                      {(() => {
                        const n = status?.tradesToday ?? trades.length;
                        return `${n} trade${n !== 1 ? "s" : ""}`;
                      })()}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4, fontFamily: "'Space Mono',monospace" }}>
                    Cumulative profit/loss updated every tick
                  </div>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {isViewer && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8,
                  background: "rgba(34,211,238,.06)", color: "var(--cyan)",
                  border: "1px solid var(--cyan)33", display: "flex", alignItems: "center", gap: 5,
                }}>
                  <Eye size={12} /> Viewer mode
                </span>
              )}
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8,
                background: "rgba(100,116,139,.06)", color: "var(--text3)",
                border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 5,
              }}>
                Real-World Assets <span className="cs-badge">Coming soon</span>
              </span>
            </div>
          </div>

          {/* Chart body: PnL chart (active) or opportunities table (viewer) */}
          <div className="chart-body" style={{ minHeight: isViewer ? 560 : 240}}>
            {isViewer ? (
              <OpportunitiesPanel market={market} />
            ) : (
              <>
                <div className="chart-scan" />
                <div style={{ position: "absolute", inset: "10px 10px 20px 10px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pnlHistory}>
                      <defs>
                        <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={currentPnl >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={currentPnl >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <YAxis hide domain={["dataMin", "dataMax"]} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--bg2)", border: "1px solid var(--border2)",
                          borderRadius: 10, fontSize: 12, color: "var(--text)",
                        }}
                        formatter={(v) => [`$${Number(v).toFixed(6)}`, "PnL"]}
                        labelFormatter={(l) => l || "Start"}
                      />
                      <Area
                        type="monotone"
                        dataKey="pnl"
                        stroke={currentPnl >= 0 ? "#22c55e" : "#ef4444"}
                        strokeWidth={2}
                        fill="url(#pnlGrad)"
                        dot={false}
                        activeDot={{ r: 4, fill: currentPnl >= 0 ? "#22c55e" : "#ef4444" }}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>

          {/* Bottom info strip */}
          {isViewer && market ? (
            <PoolStatsStrip market={market} />
          ) : (
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: 1, borderTop: "1px solid var(--border)", flexShrink: 0,
            }}>
              {bottomInfo.map((item, i) => (
                <div key={i} style={{
                  padding: "12px 16px",
                  borderRight: i < 2 ? "1px solid var(--border)" : "none",
                }}>
                  <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 4 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: item.color, fontFamily: "'Space Mono',monospace" }}>
                    {item.val}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Side column: what's happening + pool states stacked */}
        <div style={isViewer
          ? { display: "flex", flexDirection: "column", gap: 16, minHeight: 0, height: "100%" }
          : { display: "contents" }}>
        <div className="side-panel" style={isViewer ? { flex: "1 1 60%", minHeight: 0 } : undefined}>
          <div className="side-panel-header">
            What's happening
            {running && (
              <span style={{ marginLeft: 8, fontSize: 9, color: isViewer ? "var(--cyan)" : "var(--green)", fontWeight: 700, background: isViewer ? "rgba(34,211,238,.1)" : "var(--green2)", padding: "2px 7px", borderRadius: 6 }}>
                {connected ? (isViewer ? "SCANNING" : "LIVE") : "CONNECTING"}
              </span>
            )}
          </div>
          <div className="side-panel-body">
            {/* Signal cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {signals.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} style={{
                    background: s.bg, borderRadius: 10, padding: "10px 12px",
                    border: `1px solid ${s.color}22`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      <Icon size={11} color={s.color} />
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", color: s.color }}>
                        {s.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: s.color, fontFamily: "'Space Mono',monospace" }}>
                      {s.val}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", color: "var(--text3)", marginBottom: 8 }}>
              Activity log
            </div>

            <div
              className="activity-log-scroll"
              style={{
                maxHeight: 320,
                overflowY: "auto",
                paddingRight: 6,
              }}
            >
              {feedItems.map((f, i) => (
                <div key={i} className="feed-item">
                  <span className="feed-time">{f.time}</span>
                  <div
                    className="feed-dot"
                    style={{ background: f.color, boxShadow: `0 0 6px ${f.color}` }}
                  />
                  <span style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.5 }}>{f.msg}</span>
                </div>
              ))}

              {ticks.length === 0 && (isViewer || running) && (
                <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text3)", fontSize: 12 }}>
                  {isViewer ? "Scanning pools for opportunities..." : "Waiting for engine ticks..."}
                </div>
              )}

              {ticks.length === 0 && !isViewer && !running && (
                <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text3)", fontSize: 12 }}>
                  Start the bot to see live data
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Pool states — independent block under what's happening */}
        {isViewer && market && market.pools && market.pools.length > 0 && (
          <div className="side-panel" style={{ flex: "1 1 40%", minHeight: 0 }}>
            <div className="side-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Pool states</span>
              <span style={{ fontSize: 9, color: "var(--text3)", fontFamily: "'Space Mono',monospace", textTransform: "none", letterSpacing: 0 }}>
                {market.timestamp ? formatTime(market.timestamp) : "---"}
              </span>
            </div>
            <div className="side-panel-body">
              {market.pools.map((p, i) => (
                <div key={i} style={{
                  padding: "10px 0", borderBottom: i < market.pools.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text)" }}>{p.name}</span>
                    <span style={{ fontSize: 12, fontFamily: "'Space Mono',monospace", color: "var(--cyan)", fontWeight: 700 }}>
                      {p.price.toFixed(4)}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text3)", fontFamily: "'Space Mono',monospace" }}>
                    <span>{p.tokenA}/{p.tokenB}</span>
                    <span>{p.reserveA.toFixed(1)} · {p.reserveB.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Trade history (active mode only) */}
      {!browse && !isViewer && (
        <div className="trades-panel">
          <div style={{
            padding: "14px 20px", borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "var(--text3)" }}>
              Today's trades
            </div>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>
              {trades.length} trade{trades.length !== 1 ? "s" : ""}
            </span>
          </div>
          {trades.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
              No trades yet today
            </div>
          ) : (
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {/* Header */}
              <div className="trade-row trade-row-head" style={{ gridTemplateColumns: "80px 1fr 80px 80px" }}>
                <span>Time</span>
                <span>Pair</span>
                <span>Result</span>
                <span style={{ textAlign: "right" }}>Profit</span>
              </div>
              {trades.slice().reverse().map((t, i) => (
                <div key={i} className="trade-row" style={{ gridTemplateColumns: "80px 1fr 80px 80px" }}>
                  <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "'Space Mono',monospace" }}>
                    {formatTime(t.timestamp)}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {pathLabel(t)}{t.hops ? ` · ${t.hops} hops` : ""}
                  </span>
                  <span className={(t.profit || 0) >= 0 ? "badge-win" : "badge-loss"}>
                    {(t.profit || 0) >= 0 ? "Win" : "Loss"}
                  </span>
                  <span className={(t.profit || 0) >= 0 ? "pnl-up" : "pnl-dn"} style={{ textAlign: "right" }}>
                    {(t.profit || 0) >= 0 ? "+" : ""}${Math.abs(t.profit || 0).toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
