import { useState, useEffect } from "react";
import { Brain, Save, Info, Check } from "lucide-react";
import { apiSaveConfig, apiGetConfig } from "../lib/api";

const SIGNALS = [
  {
    key: "chart",
    label: "Price charts & patterns",
    cls: "r-v",
    color: "var(--v2)",
    bg: "var(--v3)",
    desc: "How much should the AI rely on historical price charts to predict the next move.",
  },
  {
    key: "social",
    label: "News & social media buzz",
    cls: "r-c",
    color: "var(--cyan)",
    bg: "var(--cyan2)",
    desc: "How much should trending topics on Twitter, Telegram, or Reddit influence decisions.",
  },
  {
    key: "whale",
    label: "What big investors are doing",
    cls: "r-p",
    color: "var(--pink)",
    bg: "var(--pink2)",
    desc: "How much should the AI follow moves made by the 500 largest crypto wallets. (Code-based tracking — always active)",
  },
];

export default function AITuning({ userId }) {
  const [weights, setWeights] = useState({ chart: 45, social: 30, whale: 25 });
  const [confidence, setConfidence] = useState(85);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [slippageMin, setSlippageMin] = useState(0.1);
  const [slippageMax, setSlippageMax] = useState(0.8);

  // Load saved config from backend on mount
  useEffect(() => {
    if (!userId) return;
    apiGetConfig(userId)
      .then((data) => {
        if (data?.aiWeights) {
          setWeights(data.aiWeights);
        }
        if (data?.aiConfidenceThreshold != null) {
          setConfidence(Math.round(data.aiConfidenceThreshold * 100));
        }
      })
      .catch(() => {});
  }, [userId]);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await apiSaveConfig(userId, {
        aiWeights: weights,
        aiConfidenceThreshold: confidence / 100,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save AI config:", err);
    } finally {
      setSaving(false);
    }
  };

  const dominant =
    weights.chart >= weights.social && weights.chart >= weights.whale
      ? { label: "Chart-focused", color: "var(--v2)",   bg: "var(--v3)",    desc: "The AI mainly looks at price history and patterns. Most stable, best track record." }
      : weights.social > weights.whale
      ? { label: "Buzz-focused",  color: "var(--cyan)",  bg: "var(--cyan2)", desc: "The AI rides viral trends early and exits before hype fades. Higher risk, higher reward." }
      : { label: "Whale-focused", color: "var(--pink)",  bg: "var(--pink2)", desc: "The AI copies what the biggest wallets are quietly doing. Needs fast execution to work." };

  const total = weights.chart + weights.social + weights.whale;

  return (
    <div>
      <div className="sec-h">
        <div>
          <div className="sec-title">How the AI thinks</div>
          <div className="sec-sub">
            Adjust what the AI pays attention to. No technical knowledge needed — just move the sliders.
          </div>
        </div>
        <button className="btn btn-v btn-sm" onClick={handleSave} disabled={saving}>
          {saved ? <><Check size={14} /> Saved</> : saving ? "Saving..." : <><Save size={14} /> Save changes</>}
        </button>
      </div>

      <div className="tuning-layout">
        {/* Sliders */}
        <div className="glass">
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".8px", color: "var(--text3)", marginBottom: 24 }}>
            What should the AI focus on?
          </div>

          {SIGNALS.map(s => (
            <div key={s.key} className="slider-row">
              <div className="slider-head">
                <span className="slider-name">{s.label}</span>
                <span className="slider-val" style={{ background: s.bg, color: s.color }}>
                  {weights[s.key]}%
                </span>
              </div>
              <input
                type="range" min={0} max={100}
                value={weights[s.key]}
                className={s.cls}
                onChange={e => setWeights({ ...weights, [s.key]: +e.target.value })}
              />
              <div className="slider-desc">{s.desc}</div>
            </div>
          ))}

          {total !== 100 && (
            <div className="ibox tip" style={{ marginTop: 8 }}>
              <Brain size={13} color="var(--v2)" style={{ flexShrink: 0 }} />
              Weights add up to {total}% — the AI will normalise them automatically.
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Confidence */}
          <div className="glass">
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".8px", color: "var(--text3)", marginBottom: 18 }}>
              How cautious should it be?
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Minimum confidence before trading</span>
                <span style={{
                  fontSize: 16, fontWeight: 900, fontFamily: "'Space Mono',monospace",
                  background: "var(--v3)", color: "var(--v2)",
                  padding: "2px 12px", borderRadius: 8,
                }}>{confidence}%</span>
              </div>
              <input
                type="range" min={50} max={99}
                value={confidence} className="r-v"
                onChange={e => setConfidence(+e.target.value)}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 11, color: "var(--text3)" }}>More trades, some risky</span>
                <span style={{ fontSize: 11, color: "var(--text3)" }}>Fewer, only the safest</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Max price change allowed (%)</div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10 }}>
                Cancel the trade if price moves more than this before it goes through.
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input className="num-inp" type="number" value={slippageMin} step="0.1"
                  onChange={e => setSlippageMin(+e.target.value)}
                  style={{ marginTop: 0, marginBottom: 0 }} />
                <span style={{ color: "var(--text3)", fontWeight: 600 }}>to</span>
                <input className="num-inp" type="number" value={slippageMax} step="0.1"
                  onChange={e => setSlippageMax(+e.target.value)}
                  style={{ marginTop: 0, marginBottom: 0 }} />
                <span style={{ color: "var(--text3)" }}>%</span>
              </div>
            </div>
          </div>

          {/* Personality */}
          <div className="glass" style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".8px", color: "var(--text3)", marginBottom: 16 }}>
              Current AI personality
            </div>

            <div
              className="personality-card"
              style={{
                background: dominant.bg,
                borderColor: `color-mix(in srgb, ${dominant.color} 25%, transparent)`,
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 900, color: dominant.color, marginBottom: 8 }}>
                {dominant.label}
              </div>
              <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
                {dominant.desc}
              </div>
            </div>

            {/* Visual weight bars */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {SIGNALS.map(s => (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "var(--text3)", width: 120, flexShrink: 0 }}>{s.label}</span>
                  <div style={{ flex: 1, height: 6, background: "var(--border2)", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{
                      width: `${weights[s.key]}%`, height: "100%",
                      background: s.color, borderRadius: 6,
                      transition: "width .5s var(--spring)",
                    }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: s.color, width: 28, textAlign: "right", fontFamily: "'Space Mono',monospace" }}>
                    {weights[s.key]}
                  </span>
                </div>
              ))}
            </div>

            <div style={{
              display: "flex", alignItems: "flex-start", gap: 8, marginTop: 16,
              padding: "12px 14px", background: "var(--bg3)", borderRadius: 10,
              border: "1px solid var(--border)",
            }}>
              <Info size={14} color="var(--text3)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.6 }}>
                The AI learns from every trade and improves itself every 24 hours automatically.
                These sliders are optional fine-tuning.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
