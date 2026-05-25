import { useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from "recharts";
import { TrendingUp, Trophy, Eye, ExternalLink, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { useEngineData } from "../hooks/useEngineData";
import { explorerTxUrl, shortAddr } from "../lib/cluster";

const TT = {
  contentStyle: {
    background: "var(--bg2)", border: "1px solid var(--border2)",
    borderRadius: 10, fontSize: 12, color: "var(--text)",
  },
  cursor: { stroke: "var(--border2)" },
};

// Visual config for each opportunity type — keep in sync with LiveCockpit
const TYPE_META = {
  arbitrage:        { label: "Arbitrage",      color: "#22d3ee", icon: "⚡" },
  yield:            { label: "Yield rotation", color: "#a78bfa", icon: "📈" },
  liquidation:      { label: "Liquidation",    color: "#fbbf24", icon: "💰" },
  directional:      { label: "AI directional", color: "#22c55e", icon: "🤖" },
  chart_pattern:    { label: "Chart pattern",  color: "#a78bfa", icon: "📊" },
  social_buzz:      { label: "Social buzz",    color: "#22d3ee", icon: "🔥" },
  copy_whale:       { label: "Copy whale",     color: "#f472b6", icon: "🐋" },
  mempool_pressure: { label: "Mempool flow",   color: "#22c55e", icon: "🌊" },
  unknown:          { label: "Other",          color: "#64748b", icon: "•" },
};

// Slow-path types currently route through the user's vault PDA via bot_swap.
// Fast-path arbitrage flows through the bot wallet with a profit sweep,
// UNLESS the user enabled useVaultFlashArb / useVaultArb — then arbitrage
// also runs under vault PDA authority.
const VAULT_ROUTED = new Set([
  "directional", "yield", "chart_pattern", "social_buzz", "copy_whale", "mempool_pressure",
]);

function formatTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AnalyticsHub({ browse, userId }) {
  const { status, trades } = useEngineData(userId, { viewer: browse });

  // ── Derive analytics from trades + status ───────────────────
  const analytics = useMemo(() => {
    const totalProfit = trades.reduce((s, t) => s + (t.profit || 0), 0);
    const wins = trades.filter((t) => (t.profit || 0) > 0).length;
    const losses = trades.filter((t) => (t.profit || 0) <= 0).length;
    const winRate = trades.length > 0 ? wins / trades.length : 0;
    const bestTrade = trades.reduce((m, t) => ((t.profit || 0) > (m?.profit || -Infinity) ? t : m), null);
    const worstTrade = trades.reduce((m, t) => ((t.profit || 0) < (m?.profit || Infinity) ? t : m), null);

    // PnL over time — cumulative by trade order
    let running = 0;
    const pnlSeries = trades
      .slice()
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      .map((t) => {
        running += t.profit || 0;
        return {
          ts: t.timestamp,
          time: t.timestamp ? new Date(t.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
          cumulative: parseFloat(running.toFixed(4)),
        };
      });

    // Daily volume (count of trades + total profit per day)
    const dayMap = new Map();
    for (const t of trades) {
      const k = dayKey(t.timestamp);
      const cur = dayMap.get(k) || { day: k, trades: 0, profit: 0 };
      cur.trades += 1;
      cur.profit += t.profit || 0;
      dayMap.set(k, cur);
    }
    const daily = Array.from(dayMap.values()).sort();

    // Per-detector breakdown
    const typeMap = new Map();
    for (const t of trades) {
      const k = t.oppType || "unknown";
      const cur = typeMap.get(k) || { type: k, count: 0, profit: 0, wins: 0 };
      cur.count += 1;
      cur.profit += t.profit || 0;
      if ((t.profit || 0) > 0) cur.wins += 1;
      typeMap.set(k, cur);
    }
    const byType = Array.from(typeMap.values())
      .map((b) => ({ ...b, winRate: b.count > 0 ? b.wins / b.count : 0 }))
      .sort((a, b) => b.profit - a.profit);

    return { totalProfit, wins, losses, winRate, bestTrade, worstTrade, pnlSeries, daily, byType };
  }, [trades]);

  // ── KPI cards from live status + derived totals ──────────────
  const kpis = [
    {
      label: "Cumulative profit",
      value: `${analytics.totalProfit >= 0 ? "+" : ""}$${analytics.totalProfit.toFixed(4)}`,
      sub: `${trades.length} trade${trades.length !== 1 ? "s" : ""} all time`,
      color: analytics.totalProfit >= 0 ? "var(--green)" : "var(--red)",
    },
    {
      label: "Win rate",
      value: `${(analytics.winRate * 100).toFixed(1)}%`,
      sub: `${analytics.wins}W / ${analytics.losses}L`,
      color: "var(--v2)",
    },
    {
      label: "Trades today",
      value: status?.tradesToday != null ? `${status.tradesToday}` : "—",
      sub: `Daily PnL: ${(status?.dailyPnl ?? 0) >= 0 ? "+" : ""}$${(status?.dailyPnl ?? 0).toFixed(4)}`,
      color: "var(--cyan)",
    },
    {
      label: "Vault profit",
      value: `${(status?.vaultProfit ?? 0) >= 0 ? "+" : ""}$${(status?.vaultProfit ?? 0).toFixed(4)}`,
      sub: `Balance: $${(status?.vaultBalance ?? 0).toFixed(2)}`,
      color: (status?.vaultProfit ?? 0) >= 0 ? "var(--green)" : "var(--red)",
    },
    {
      label: "Best trade",
      value: analytics.bestTrade ? `+$${(analytics.bestTrade.profit || 0).toFixed(4)}` : "—",
      sub: analytics.bestTrade ? (TYPE_META[analytics.bestTrade.oppType]?.label ?? "—") : "no trades yet",
      color: "var(--green)",
    },
    {
      label: "Drawdown",
      value: `$${(status?.drawdownUsed ?? 0).toFixed(2)} / $${(status?.drawdownLimit ?? 0).toFixed(0)}`,
      sub: `${(((status?.drawdownUsed ?? 0) / Math.max(1, status?.drawdownLimit ?? 1)) * 100).toFixed(1)}% used`,
      color: "var(--gold)",
    },
  ];

  return (
    <div>
      <div className="sec-h">
        <div>
          <div className="sec-title">My Results</div>
          <div className="sec-sub">
            {browse
              ? "Connect your wallet to see real performance numbers from your bot."
              : "Live performance fed directly from the bot. No mocks."}
          </div>
        </div>
      </div>

      {browse && (
        <div className="ibox tip" style={{ marginBottom: 20 }}>
          <Eye size={14} color="var(--v2)" style={{ flexShrink: 0 }} />
          <span>
            <strong>Preview mode</strong> — connect a wallet to see your trades, PnL, and per-strategy breakdown.
          </span>
        </div>
      )}

      {/* KPI row */}
      <div className="analytics-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div key={i} className="kpi-card" style={{ "--kpi-color": k.color }}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="analytics-body">
        {/* Charts column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Cumulative PnL */}
          <div className="glass" style={{ padding: "20px 20px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <TrendingUp size={15} color="var(--green)" />
              <span style={{ fontSize: 13, fontWeight: 800 }}>Cumulative PnL</span>
              <span style={{ fontSize: 11, color: "var(--text3)", marginLeft: "auto" }}>
                {analytics.pnlSeries.length} data points
              </span>
            </div>
            {analytics.pnlSeries.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text3)", fontSize: 12 }}>
                No trades yet. PnL chart appears after your first executed trade.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={analytics.pnlSeries}>
                  <defs>
                    <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#22c55e" stopOpacity=".35" />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" stroke="var(--text3)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text3)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip {...TT} formatter={(v) => [`$${v}`, "Cumulative"]} />
                  <Area type="monotone" dataKey="cumulative" stroke="#22c55e" strokeWidth={2.5} fill="url(#pg)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Daily breakdown */}
          <div className="glass" style={{ padding: "20px 20px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 16 }}>Daily activity</div>
            {analytics.daily.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text3)", fontSize: 12 }}>
                No daily data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={analytics.daily}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--text3)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" stroke="var(--text3)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--text3)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                  <Tooltip {...TT} />
                  <Bar yAxisId="left" dataKey="trades" name="Trades" fill="#22d3ee" fillOpacity={0.7} radius={[6, 6, 0, 0]} />
                  <Bar yAxisId="right" dataKey="profit" name="Profit ($)" fill="#22c55e" fillOpacity={0.7} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right column: per-detector breakdown */}
        <div className="glass">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <Trophy size={15} color="var(--gold)" />
            <span style={{ fontSize: 13, fontWeight: 800 }}>By strategy</span>
          </div>
          {analytics.byType.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text3)", fontSize: 12 }}>
              No strategy data yet.
            </div>
          ) : (
            analytics.byType.map((b) => {
              const meta = TYPE_META[b.type] ?? TYPE_META.unknown;
              return (
                <div key={b.type} className="win-bar" style={{ marginBottom: 14 }}>
                  <div className="win-bar-head">
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </span>
                    <span style={{ fontFamily: "'Space Mono',monospace", fontWeight: 800, color: meta.color }}>
                      {(b.winRate * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="win-bar-track">
                    <div className="win-bar-fill" style={{
                      width: `${b.winRate * 100}%`,
                      background: `linear-gradient(90deg, ${meta.color}99, ${meta.color})`,
                    }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text3)", marginTop: 4 }}>
                    <span>{b.count} trade{b.count !== 1 ? "s" : ""}</span>
                    <span style={{ color: b.profit >= 0 ? "var(--green)" : "var(--red)" }}>
                      {b.profit >= 0 ? "+" : ""}${b.profit.toFixed(4)}
                    </span>
                  </div>
                </div>
              );
            })
          )}

          <div className="divider" />

          <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.7 }}>
            <strong style={{ color: "var(--text2)" }}>Tip:</strong> Strategies with negative profit
            are dragging your overall return. Disable them in <strong style={{ color: "var(--v2)" }}>My Setup</strong>.
          </div>
        </div>
      </div>

      {/* Trade history */}
      <div className="glass" style={{ marginTop: 20, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800 }}>
            <Activity size={14} color="var(--v2)" /> Trade history
          </span>
          <span style={{ fontSize: 11, color: "var(--text3)" }}>
            {trades.length} record{trades.length !== 1 ? "s" : ""}
          </span>
        </div>
        {trades.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text3)", fontSize: 12 }}>
            No trades yet. Run the bot to populate this list.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--bg3)", color: "var(--text3)", textTransform: "uppercase", fontSize: 10, letterSpacing: ".8px" }}>
                  <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 700 }}>Time</th>
                  <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 700 }}>Type</th>
                  <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 700 }}>Pair</th>
                  <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 700 }}>Route</th>
                  <th style={{ textAlign: "right", padding: "10px 16px", fontWeight: 700 }}>Profit</th>
                  <th style={{ textAlign: "right", padding: "10px 16px", fontWeight: 700 }}>Tx</th>
                </tr>
              </thead>
              <tbody>
                {trades
                  .slice()
                  .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                  .slice(0, 50)
                  .map((t, i) => {
                    const meta = TYPE_META[t.oppType] ?? TYPE_META.unknown;
                    const profitPos = (t.profit || 0) >= 0;
                    return (
                      <tr key={t.signature || i} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px 16px", color: "var(--text2)", fontFamily: "'Space Mono',monospace" }}>
                          {formatTime(t.timestamp)}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            padding: "3px 8px", borderRadius: 6,
                            background: `${meta.color}15`, color: meta.color,
                            fontSize: 11, fontWeight: 700,
                          }}>
                            <span>{meta.icon}</span> {meta.label}
                          </span>
                        </td>
                        <td style={{ padding: "10px 16px", color: "var(--text)", fontFamily: "'Space Mono',monospace" }}>
                          {t.pair || t.pool || "—"}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          {VAULT_ROUTED.has(t.oppType) ? (
                            <span style={{
                              padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                              background: "rgba(34,197,94,.1)", color: "var(--green)",
                              border: "1px solid rgba(34,197,94,.25)",
                            }} title="Tokens moved under your vault PDA's authority — bot wallet never held them">
                              🔒 Vault PDA
                            </span>
                          ) : (
                            <span style={{
                              padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                              background: "rgba(34,211,238,.1)", color: "var(--cyan)",
                              border: "1px solid rgba(34,211,238,.25)",
                            }} title="Flash-loan arb: working capital transits the bot wallet briefly; profit is swept to your vault atomically">
                              ⚡ Flash + sweep
                            </span>
                          )}
                        </td>
                        <td style={{
                          padding: "10px 16px", textAlign: "right",
                          color: profitPos ? "var(--green)" : "var(--red)",
                          fontFamily: "'Space Mono',monospace", fontWeight: 700,
                        }}>
                          {profitPos ? <ArrowUpRight size={11} style={{ display: "inline" }} /> : <ArrowDownRight size={11} style={{ display: "inline" }} />}
                          {" "}{profitPos ? "+" : ""}${(t.profit || 0).toFixed(4)}
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right" }}>
                          {t.signature ? (
                            <a href={explorerTxUrl(t.signature)} target="_blank" rel="noreferrer"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--cyan)", textDecoration: "none", fontFamily: "'Space Mono',monospace", fontSize: 11 }}
                              title={t.signature}
                            >
                              {shortAddr(t.signature, 6, 6)} <ExternalLink size={10} />
                            </a>
                          ) : (
                            <span style={{ color: "var(--text3)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
