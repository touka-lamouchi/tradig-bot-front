import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Wallet, Eye, Zap, ArrowRight, Shield } from "lucide-react";
import { signIn } from "../lib/auth";

export default function AuthPage({ onLogin }) {
  const { publicKey, connected, disconnect, signMessage } = useWallet();
  const { connection } = useConnection();
  const { setVisible: openWalletModal } = useWalletModal();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("choose");

  // When wallet connects, fetch balance and log in
  useEffect(() => {
    if (connected && publicKey && step === "connect") {
      setLoading(true);
      const pk = publicKey.toBase58();
      const addr = pk.slice(0, 4) + "..." + pk.slice(-4);

      (async () => {
        // Sign-In With Solana: prove wallet ownership → get a JWT. Best-effort:
        // if the backend is in devnet-bypass mode this may no-op, and we don't
        // block login on a sign-in failure (e.g. user declines the signature).
        try {
          if (signMessage) await signIn(pk, signMessage);
        } catch (e) {
          console.warn("SIWS sign-in skipped/failed:", e?.message ?? e);
        }

        let sol = 0;
        try {
          const balance = await connection.getBalance(publicKey);
          sol = parseFloat((balance / LAMPORTS_PER_SOL).toFixed(2));
        } catch {
          /* balance fetch is non-critical */
        }
        onLogin(addr, sol, "trade", pk);
      })();
    }
  }, [connected, publicKey, step]);

  const handleBrowse = () => onLogin(null, 0, "browse", null);

  const handleConnect = () => {
    setStep("connect");
    openWalletModal(true);
  };

  if (step === "connect" && !connected) {
    return (
      <div className="landing">
        <div className="landing-grid-bg" />
        <div style={{ position: "relative", zIndex: 2, width: "100%", animation: "fadeUp .4s ease" }}>
          <div className="wc-panel">
            <button className="wc-back" onClick={() => setStep("choose")}>
              &larr; Back
            </button>

            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div
                style={{
                  width: 60, height: 60, borderRadius: "50%",
                  background: "var(--v3)", border: "2px solid rgba(124,58,237,.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 14px",
                  boxShadow: "0 0 32px var(--v3)",
                }}
              >
                <Wallet size={26} color="var(--v2)" />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-.5px", marginBottom: 8 }}>
                Connect your wallet
              </h2>
              <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65 }}>
                Your keys never leave your device. We only send transactions you approve.
              </p>
            </div>

            <button
              className="wc-wallet-btn phantom"
              onClick={() => openWalletModal(true)}
              disabled={loading}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Wallet size={17} />
                {loading ? "Connecting..." : "Select Wallet"}
              </span>
              {!loading && <ArrowRight size={16} />}
            </button>

            <div className="wc-secure">
              <Shield size={13} />
              Your keys stay on your device — always
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing">
      <div className="landing-grid-bg" />

      <div className="landing-inner">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div className="l-badge">
            <span className="l-dot" />
            Solana &middot; Crypto Markets &middot; Live
          </div>
        </div>

        <h1 className="l-title">
          Your money,
          <br />
          <span className="g">working 24/7</span>
        </h1>

        <p className="l-sub">
          We scan crypto markets around the clock and spot profitable moments
          automatically. No trading experience needed — you choose how much
          control you keep.
        </p>

        <div className="l-choices">
          {/* Browse */}
          <button className="l-card lc-g" onClick={handleBrowse}>
            <div className="lc-icon g">
              <Eye size={22} color="var(--gold)" />
            </div>
            <div className="lc-title">Just show me the deals</div>
            <div className="lc-desc">
              See every opportunity we spot in real time. No wallet, no
              commitment — just watch what the AI finds.
            </div>
            <span className="lc-tag g">
              <Shield size={10} /> No wallet needed
            </span>
          </button>

          {/* Trade */}
          <button className="l-card lc-v" onClick={handleConnect}>
            <div className="lc-icon v">
              <Zap size={22} color="var(--v2)" />
            </div>
            <div className="lc-title">Let it trade for me</div>
            <div className="lc-desc">
              Connect your wallet and let the system act on those deals —
              automatically or asking you first every time.
            </div>
            <span className="lc-tag v">
              <Zap size={10} /> Wallet required
            </span>
          </button>
        </div>

        <p className="l-note">
          Free to start &middot; Switch modes anytime &middot; Cancel anytime
        </p>
      </div>
    </div>
  );
}
