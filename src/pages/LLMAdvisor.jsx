import { useMemo } from "react";
import { Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { useEngineData } from "../hooks/useEngineData";

const TYPE_LABEL = {
  arbitrage:        "Triangular arb",
  yield:            "Yield rotation",
  liquidation:      "Liquidation",
  directional:      "AI directional",
  chart_pattern:    "Chart pattern",
  social_buzz:      "Social buzz",
  copy_whale:       "Copy whale",
  mempool_pressure: "Mempool flow",
  unknown:          "Other",
};

function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPnl(profit) {
  if (profit == null) return "$0.00";
  return `${profit >= 0 ? "+" : "-"}$${Math.abs(profit).toFixed(2)}`;
}

export default function LLMAdvisor({ userId }) {
  const { status, trades } = useEngineData(userId);

  // Derive real insights from actual trade data
  const insights = useMemo(() => {
    if (!trades || trades.length === 0) return null;

    const total = trades.length;
    const wins = trades.filter((t) => (t.profit || 0) > 0);
    const losses = trades.filter((t) => (t.profit || 0) <= 0);
    const totalProfit = trades.reduce((s, t) => s + (t.profit || 0), 0);
    const winRate = total > 0 ? wins.length / total : 0;

    // Group by oppType
    const byType = {};
    for (const t of trades) {
      const k = t.oppType || "unknown";
      if (!byType[k]) byType[k] = { wins: 0, losses: 0, profit: 0 };
      if ((t.profit || 0) > 0) byType[k].wins++;
      else byType[k].losses++;
      byType[k].profit += t.profit || 0;
    }

    // Best and worst performing type
    const typeEntries = Object.entries(byType).map(([type, s]) => ({
      type,
      ...s,
      total: s.wins + s.losses,
      winRate: s.wins / (s.wins + s.losses),
    }));
    const best = typeEntries.sort((a, b) => b.winRate - a.winRate)[0];
    const worst = typeEntries.sort((a, b) => a.winRate - b.winRate)[0];

    // Build suggestions based on actual data
    const suggestions = [];
    if (worst && worst.total >= 2 && worst.winRate < 0.4) {
      suggestions.push(`Consider disabling ${TYPE_LABEL[worst.type] || worst.type} — only ${Math.round(worst.winRate * 100)}% win rate across ${worst.total} trades`);
    }
    if (best && best.total >= 2 && best.winRate > 0.6) {
      suggestions.push(`${TYPE_LABEL[best.type] || best.type} is performing best (${Math.round(best.winRate * 100)}% win rate) — keep it enabled`);
    }
    if (winRate < 0.5 && total >= 5) {
      suggestions.push("Win rate is below 50% — review your AI confidence threshold in AI Brain settings");
    }
    if (totalProfit > 0 && winRate > 0.6) {
      suggestions.push("Strategy is profitable and consistent — no changes needed");
    }
    if (suggestions.length === 0) {
      suggestions.push("Not enough trade history yet to make recommendations — keep the bot running");
    }

    return { total, wins: wins.length, losses: losses.length, totalProfit, winRate, best, worst, byType, typeEntries, suggestions };
  }, [trades]);

  const loading = !status;
  const noTrades = !loading && trades.length === 0;

  return (
    <div>
      <div className="sec-h">
        <div>
          <div className="sec-title">Advisor</div>
          <div className="sec-sub">What the AI learned from your trades and what it recommends.</div>
        </div>
      </div>

      <div className="advisor-layout">
        {/* Trade history — real data */}
        <div className="glass" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Your trades — last 7 days</div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{trades.length} trades recorded</div>
          </div>

          <div className="trade-row trade-row-head" style={{ padding: "10px 16px" }}>
            <span>Date</span>
            <span>Strategy</span>
            <span>Pool</span>
            <span>Result</span>
            <span>Profit</span>
          </div>

          {noTrades ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
              No trades yet. Start the bot and run <code style={{ fontSize: 11, color: "var(--v2)" }}>npx ts-node scripts/devnet/create_arb.ts</code> to generate an opportunity.
            </div>
          ) : (
            trades.slice().reverse().slice(0, 20).map((t, i) => {
              const win = (t.profit || 0) > 0;
              return (
                <div key={i} className="trade-row">
                  <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "'Space Mono',monospace" }}>
                    {formatDate(t.timestamp)}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>
                    {TYPE_LABEL[t.oppType] || t.oppType || "—"}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text2)" }}>{t.pair || t.pool || "—"}</span>
                  <span className={win ? "badge-win" : "badge-loss"}>{win ? "Win" : "Loss"}</span>
                  <span className={win ? "pnl-up" : "pnl-dn"}>{formatPnl(t.profit)}</span>
                </div>
              );
            })
          )}
        </div>

        {/* AI insights panel — derived from real data */}
        <div className="insight-panel">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <Sparkles size={16} color="var(--v2)" />
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--v2)" }}>What the AI thinks</span>
          </div>

          {noTrades ? (
            <div style={{ fontSize: 13, color: "var(--text3)", fontStyle: "italic" }}>
              No trade data yet. Insights will appear once the bot executes its first trade.
            </div>
          ) : !insights ? (
            <div style={{ fontSize: 13, color: "var(--text3)" }}>Loading…</div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7, marginBottom: 18 }}>
                Analyzed <strong style={{ color: "var(--text)" }}>{insights.total} trade{insights.total !== 1 ? "s" : ""}</strong>.
                {" "}Overall you're{" "}
                <strong style={{ color: insights.totalProfit >= 0 ? "var(--green)" : "var(--red)" }}>
                  {insights.totalProfit >= 0 ? "+" : "-"}${Math.abs(insights.totalProfit).toFixed(2)}
                </strong>{" "}
                with a <strong style={{ color: "var(--text)" }}>{Math.round(insights.winRate * 100)}% win rate</strong>.
              </p>

              {insights.best && insights.best.total >= 2 && (
                <div className="ibox ok" style={{ marginBottom: 12 }}>
                  <h4 style={{ color: "var(--green)", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <CheckCircle2 size={14} /> What's working
                  </h4>
                  <span style={{ fontSize: 13 }}>
                    {TYPE_LABEL[insights.best.type] || insights.best.type} has the best win rate ({Math.round(insights.best.winRate * 100)}% across {insights.best.total} trades, +${insights.best.profit.toFixed(2)} total).
                  </span>
                </div>
              )}

              {insights.worst && insights.worst.total >= 2 && insights.worst.winRate < 0.5 && (
                <div className="ibox err" style={{ marginBottom: 12 }}>
                  <h4 style={{ color: "var(--red)", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <AlertTriangle size={14} /> What's underperforming
                  </h4>
                  <span style={{ fontSize: 13 }}>
                    {TYPE_LABEL[insights.worst.type] || insights.worst.type} is only winning {Math.round(insights.worst.winRate * 100)}% of the time ({insights.worst.total} trades, ${insights.worst.profit.toFixed(2)} total).
                  </span>
                </div>
              )}

              {/* Strategy breakdown */}
              {insights.typeEntries.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".8px", color: "var(--text3)", marginBottom: 10 }}>
                    By strategy
                  </div>
                  {insights.typeEntries.map(({ type, wins, losses, profit, winRate: wr }) => (
                    <div key={type} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                      <span style={{ color: "var(--text2)" }}>{TYPE_LABEL[type] || type}</span>
                      <span style={{ color: "var(--text3)" }}>{wins}W / {losses}L</span>
                      <span style={{ color: "var(--text3)" }}>{Math.round(wr * 100)}%</span>
                      <span style={{ color: profit >= 0 ? "var(--green)" : "var(--red)", fontFamily: "'Space Mono',monospace" }}>
                        {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestions */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".8px", color: "var(--text3)", marginBottom: 10 }}>
                  Suggestions
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {insights.suggestions.map((s, i) => (
                    <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "var(--text2)", lineHeight: 1.6, marginBottom: 8 }}>
                      <span style={{ color: "var(--v2)", fontWeight: 800, flexShrink: 0 }}>→</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
