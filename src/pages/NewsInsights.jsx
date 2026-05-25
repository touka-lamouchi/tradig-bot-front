import { useEffect, useState } from "react";
import { Newspaper, Globe2, TrendingUp, TrendingDown, Minus, Sparkles, ExternalLink, RefreshCw } from "lucide-react";
import { apiGetNews } from "../lib/api";

const REFRESH_MS = 30_000;

function relTime(ts) {
  if (!ts) return "—";
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return `${Math.floor(d)}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

function DirectionPill({ dir }) {
  const map = {
    bullish:  { color: "var(--green)", icon: TrendingUp,   label: "Bullish" },
    bearish:  { color: "var(--red)",   icon: TrendingDown, label: "Bearish" },
    neutral:  { color: "var(--text3)", icon: Minus,        label: "Neutral" },
    unknown:  { color: "var(--text3)", icon: Minus,        label: "No data" },
  };
  const m = map[dir] ?? map.unknown;
  const Icon = m.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999,
      fontSize: 11, fontWeight: 700,
      color: m.color, border: `1px solid ${m.color}`, background: `${m.color}10`,
    }}>
      <Icon size={11} /> {m.label}
    </span>
  );
}

function ScoreBar({ score, label }) {
  // score in [-1, +1]; render as a bar from center
  const pct = Math.max(-1, Math.min(1, score ?? 0));
  const width = Math.abs(pct) * 50;
  const color = pct > 0.05 ? "var(--green)" : pct < -0.05 ? "var(--red)" : "var(--text3)";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontFamily: "'Space Mono',monospace", color: "var(--text2)" }}>
          {pct >= 0 ? "+" : ""}{pct.toFixed(3)}
        </span>
      </div>
      <div style={{ height: 6, background: "var(--bg2)", borderRadius: 3, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--border)" }} />
        <div style={{
          position: "absolute", top: 0, bottom: 0,
          left: pct >= 0 ? "50%" : `${50 - width}%`,
          width: `${width}%`,
          background: color,
        }} />
      </div>
    </div>
  );
}

function FeedCard({ icon: Icon, title, source, data }) {
  const headlines = data?.headlines ?? [];
  return (
    <div className="glass" style={{ padding: 20, display: "flex", flexDirection: "column", minHeight: 320 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Icon size={18} color="var(--v2)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>
          <div style={{ fontSize: 11, color: "var(--text3)" }}>{source}</div>
        </div>
        <DirectionPill dir={
          !data ? "unknown"
          : data.score > 0.15 ? "bullish"
          : data.score < -0.15 ? "bearish"
          : "neutral"
        } />
      </div>

      <ScoreBar score={data?.score ?? 0} label="Sentiment score" />

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text3)", marginBottom: 14 }}>
        <span>{data?.count ?? 0} headlines analyzed</span>
        <span>Updated {relTime(data?.updatedAt)}</span>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".8px", color: "var(--text3)", marginBottom: 8 }}>
          Top headlines
        </div>
        {headlines.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text3)", fontStyle: "italic" }}>
            No headlines in the current window. The feed polls every minute or two — check back shortly.
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {headlines.map((h, i) => (
              <li key={i} style={{
                fontSize: 12, color: "var(--text2)", lineHeight: 1.5,
                padding: "8px 0", borderBottom: i < headlines.length - 1 ? "1px solid var(--border)" : "none",
                display: "flex", gap: 8, alignItems: "flex-start",
              }}>
                <span style={{ color: "var(--v2)", fontWeight: 800, flexShrink: 0 }}>•</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DecisionPanel({ decision, news }) {
  if (!decision) {
    return (
      <div className="glass" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Sparkles size={16} color="var(--v2)" />
          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--v2)" }}>What the bot decided</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--text3)", fontStyle: "italic" }}>
          Waiting for the first AI tick to land. The viewer engine scans the market every 10 seconds.
        </div>
      </div>
    );
  }

  const b = decision.breakdown ?? {};
  const dirColor = decision.direction === "bullish" ? "var(--green)"
                 : decision.direction === "bearish" ? "var(--red)" : "var(--text3)";

  return (
    <div className="glass" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Sparkles size={16} color="var(--v2)" />
        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--v2)" }}>What the bot decided</span>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 140px" }}>
          <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 4 }}>Overall direction</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: dirColor, textTransform: "capitalize" }}>{decision.direction}</div>
          <div style={{ fontSize: 11, color: "var(--text3)" }}>AI score {(decision.aiScore * 100).toFixed(1)}%</div>
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 4 }}>Market regime</div>
          <div style={{ fontSize: 16, fontWeight: 700, textTransform: "capitalize" }}>{decision.regime ?? "unknown"}</div>
          <div style={{ fontSize: 11, color: "var(--text3)" }}>From price-pattern model</div>
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 4 }}>News pulse</div>
          <DirectionPill dir={decision.newsDirection ?? "unknown"} />
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
            {decision.newsHeadlineCount ?? 0} headlines weighed
          </div>
        </div>
      </div>

      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".8px", color: "var(--text3)", marginBottom: 8 }}>
        Signal breakdown
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 12 }}>
        {[
          { k: "chartScore",   label: "Chart pattern" },
          { k: "socialScore",  label: "Social media" },
          { k: "whaleScore",   label: "Whale moves" },
          { k: "mempoolScore", label: "DEX flow" },
          { k: "newsScore",    label: "News + geopolitics" },
        ].map(({ k, label }) => {
          const v = b[k] ?? 0.5;
          const pct = Math.round(v * 100);
          const tone = v > 0.55 ? "var(--green)" : v < 0.45 ? "var(--red)" : "var(--text3)";
          return (
            <div key={k} style={{ background: "var(--bg2)", padding: "10px 12px", borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: tone }}>{pct}%</div>
              <div style={{ height: 3, background: "var(--bg)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: tone }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="ibox tip" style={{ marginTop: 12 }}>
        <Sparkles size={13} color="var(--v2)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, lineHeight: 1.6 }}>
          {summarize(decision, news)}
        </span>
      </div>
    </div>
  );
}

function summarize(decision, news) {
  const parts = [];
  if (decision.direction === "bullish") parts.push("The combined signals lean bullish.");
  else if (decision.direction === "bearish") parts.push("The combined signals lean bearish.");
  else parts.push("The combined signals are mixed — no strong direction.");

  if (decision.regime === "crash") parts.push("Price-pattern model is flagging crash conditions.");
  else if (decision.regime === "trending") parts.push("Price action is trending.");
  else if (decision.regime === "ranging") parts.push("Price action is ranging.");

  if (decision.newsDirection === "bullish" && (decision.newsHeadlineCount ?? 0) > 0) {
    parts.push(`News flow is positive across ${decision.newsHeadlineCount} headlines.`);
  } else if (decision.newsDirection === "bearish" && (decision.newsHeadlineCount ?? 0) > 0) {
    parts.push(`News flow is negative across ${decision.newsHeadlineCount} headlines.`);
  }

  if (decision.whaleDirection && decision.whaleDirection !== "unknown") {
    parts.push(`Whales are ${decision.whaleDirection === "bullish" ? "accumulating" : decision.whaleDirection === "bearish" ? "distributing" : "holding"}.`);
  }

  return parts.join(" ");
}

export default function NewsInsights({ browse }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const refresh = async () => {
    try {
      const d = await apiGetNews();
      setData(d);
      setErr(null);
    } catch (e) {
      setErr(e.message ?? "Failed to load news");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <div className="sec-h">
        <div>
          <div className="sec-title">News & Insights</div>
          <div className="sec-sub">
            What the bot is reading and how it's shaping its decisions right now.
          </div>
        </div>
        <button className="btn btn-sm" onClick={refresh} title="Refresh" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {browse && (
        <div className="ibox tip" style={{ marginBottom: 20 }}>
          <Sparkles size={14} color="var(--v2)" style={{ flexShrink: 0 }} />
          <span>
            You're in <strong>view-only mode</strong>. This is the same news + signal aggregation the bot uses to decide trades.
            Connect a wallet to act on it.
          </span>
        </div>
      )}

      {loading && !data && (
        <div className="glass" style={{ padding: 24, textAlign: "center", color: "var(--text3)" }}>
          Loading news feeds…
        </div>
      )}

      {err && (
        <div className="ibox err" style={{ marginBottom: 20 }}>
          <span>Could not load news: {err}</span>
        </div>
      )}

      {data && (
        <>
          <DecisionPanel decision={data.decision} news={data} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, marginTop: 16 }}>
            <FeedCard
              icon={Newspaper}
              title={`Crypto news — ${(data.symbol ?? "sol").toUpperCase()}`}
              source="CoinDesk · Cointelegraph · CryptoPanic"
              data={data.crypto}
            />
            <FeedCard
              icon={Globe2}
              title="Geopolitics & macro"
              source="GDELT 2.0 · Reuters World"
              data={data.geopolitics}
            />
          </div>

          {data.crypto?.headlines?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".8px", color: "var(--text3)", marginBottom: 8 }}>
                Sources
              </div>
              <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.7 }}>
                Crypto sentiment is computed by Gemini 2.0 Flash (or VADER fallback) over the latest CoinDesk + Cointelegraph headlines mentioning {(data.symbol ?? "sol").toUpperCase()}.
                Geopolitics is sourced from GDELT 2.0's global event index, filtered for regulation, sanctions, Fed policy, and ETF news, then scored the same way.
                Magnitude weighting decays older headlines so fresh news dominates the read.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
