import { useState, useCallback, useEffect } from "react";
import {
  Zap, LayoutDashboard, BarChart3, BrainCircuit, SlidersHorizontal,
  Play, Pause, Bell, Sun, Moon, Eye, Wallet, TrendingUp, Newspaper
} from "lucide-react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useTheme } from "./context/ThemeContext.jsx";
import BotBuilder from "./pages/BotBuilder.jsx";
import LiveCockpit from "./pages/LiveCockpit.jsx";
import AnalyticsHub from "./pages/AnalyticsHub.jsx";
import LLMAdvisor from "./pages/LLMAdvisor.jsx";
import AITuning from "./pages/AITuning.jsx";
import NewsInsights from "./pages/NewsInsights.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import { apiStartBot, apiStopBot } from "./lib/api";
import useLivePrices from "./hooks/useLivePrices";

// Viewer mode (no wallet): just Live + News.
// Trading mode (wallet connected): full nav including Insights/Results.
const NAV_ITEMS = [
  { id: "cockpit",   label: "Live",                 icon: LayoutDashboard },
  { id: "news",      label: "News & Insights",      icon: Newspaper },
  { id: "builder",   label: "My Setup",             icon: SlidersHorizontal, tradeOnly: true },
  { id: "tuning",    label: "AI Brain",             icon: BrainCircuit,      tradeOnly: true },
  { id: "advisor",   label: "Advisor",              icon: Zap,               tradeOnly: true },
  { id: "analytics", label: "Results",              icon: BarChart3,         tradeOnly: true },
];

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState(0);
  const [mode, setMode] = useState(null);
  const [userId, setUserId] = useState(null);
  const [tab, setTab] = useState("cockpit");
  const [running, setRunning] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { disconnect } = useWallet();
  const { connection } = useConnection();
  const ticker = useLivePrices();

  // Refresh SOL balance every 10s while authed (so it updates after txs).
  useEffect(() => {
    if (!authed || !userId || !connection) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const lamports = await connection.getBalance(new PublicKey(userId));
        if (!cancelled) setBalance((lamports / LAMPORTS_PER_SOL).toFixed(4));
      } catch { /* ignore */ }
    };
    refresh();
    const id = setInterval(refresh, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, [authed, userId, connection]);

  const handleLogin = (addr, bal, m, fullPubkey) => {
    setWallet(addr); setBalance(bal); setMode(m); setUserId(fullPubkey); setAuthed(true);
  };

  const handleLogout = () => {
    if (running && userId) apiStopBot(userId).catch(() => {});
    disconnect().catch(() => {});
    setAuthed(false); setWallet(null); setBalance(0); setMode(null); setUserId(null); setRunning(false);
  };

  const toggleBot = useCallback(async () => {
    if (!userId) return;
    try {
      if (running) {
        await apiStopBot(userId);
        setRunning(false);
      } else {
        await apiStartBot(userId);
        setRunning(true);
      }
    } catch (err) {
      console.error("Bot toggle failed:", err);
    }
  }, [userId, running]);

  const isBrowse = mode === "browse";

  // Snap viewers off any trade-only tab they were on previously.
  // Must run before any early return — Rules of Hooks.
  useEffect(() => {
    if (!isBrowse) return;
    const item = NAV_ITEMS.find(n => n.id === tab);
    if (item?.tradeOnly) setTab("cockpit");
  }, [isBrowse, tab]);

  if (!authed) return <AuthPage onLogin={handleLogin} />;

  const visibleNav = NAV_ITEMS.filter(n => !(isBrowse && n.tradeOnly));

  return (
    <div className="shell">
      {/* Ticker tape */}
      <div className="ticker-wrap">
        <div className="ticker-track">
          {[...ticker, ...ticker].map((t, i) => (
            <div key={i} className="ticker-item">
              <span className="sym">{t.sym}</span>
              <span>${t.price}</span>
              <span className={t.up ? "up" : "dn"}>{t.chg}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top nav */}
      <nav className="topnav">
        {/* Logo */}
        <div className="nav-logo">
          <div className="nav-logo-icon">
            <TrendingUp size={16} color="white" />
          </div>
          <div>
            <span className="nav-logo-text">Nexus</span>
            <span className="nav-logo-sub">AI Trading</span>
          </div>
        </div>

        {/* Pills */}
        <div className="nav-pills">
          {visibleNav.map(n => {
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                className={`nav-pill ${tab === n.id ? "active" : ""}`}
                onClick={() => setTab(n.id)}
              >
                <Icon size={14} />
                {n.label}
              </button>
            );
          })}
        </div>

        {/* Right side */}
        <div className="nav-right">
          {isBrowse ? (
            <div className="browse-badge">
              <Eye size={12} />
              View only
            </div>
          ) : (
            <div className="nav-status">
              <div className="nav-status-dot" />
              LIVE
            </div>
          )}

          <button className="nav-icon-btn" onClick={toggleTheme}>
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button className="nav-icon-btn">
            <Bell size={15} />
          </button>

          {isBrowse ? (
            <button className="btn btn-gold btn-sm" onClick={handleLogout}>
              <Wallet size={13} /> Connect Wallet
            </button>
          ) : (
            <>
              <div className="nav-wallet">
                <div className="nav-wallet-avatar" />
                <div>
                  <div className="nav-wallet-addr">{wallet}</div>
                  <div className="nav-wallet-bal">{balance} SOL</div>
                </div>
              </div>
              <button
                className={`nav-run-btn ${running ? "on" : "off"}`}
                onClick={toggleBot}
              >
                {running ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Start</>}
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Content */}
      <div className="content-area">
        {tab === "cockpit"   && <LiveCockpit browse={isBrowse} running={running} userId={userId} />}
        {tab === "news"      && <NewsInsights browse={isBrowse} />}
        {tab === "builder"   && !isBrowse && <BotBuilder userId={userId} />}
        {tab === "tuning"    && !isBrowse && <AITuning userId={userId} />}
        {tab === "advisor"   && !isBrowse && <LLMAdvisor userId={userId} />}
        {tab === "analytics" && !isBrowse && <AnalyticsHub browse={isBrowse} userId={userId} />}
      </div>
    </div>
  );
}
