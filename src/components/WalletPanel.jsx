import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { Wallet, Copy, ExternalLink, Check, RefreshCw, Activity, Lock, TrendingUp } from "lucide-react";
import { CLUSTER, TRACKED_TOKENS, explorerTxUrl, explorerAddressUrl, shortAddr } from "../lib/cluster";
import { deriveVaultPDA } from "../lib/vault_client";

export default function WalletPanel() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [solBalance, setSolBalance] = useState(0);
  const [tokens, setTokens] = useState([]);
  const [vaultTokens, setVaultTokens] = useState([]);
  const [vaultPdaStr, setVaultPdaStr] = useState("");
  const [activity, setActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [copied, setCopied] = useState(null);

  const refresh = useCallback(async () => {
    if (!publicKey || !connection) return;
    try {
      const { pda: vaultPda } = deriveVaultPDA(publicKey);
      setVaultPdaStr(vaultPda.toBase58());

      // Wallet token balances + vault PDA token balances in parallel
      const [lamports, walletRows, vaultRows] = await Promise.all([
        connection.getBalance(publicKey),
        Promise.all(TRACKED_TOKENS.map(async (t) => {
          const mint = new PublicKey(t.mint);
          const ata = await getAssociatedTokenAddress(mint, publicKey);
          let uiAmount = 0;
          try {
            const r = await connection.getTokenAccountBalance(ata);
            uiAmount = r.value.uiAmount || 0;
          } catch { /* no ATA yet */ }
          return { ...t, ata: ata.toBase58(), uiAmount };
        })),
        Promise.all(TRACKED_TOKENS.map(async (t) => {
          const mint = new PublicKey(t.mint);
          const ata = await getAssociatedTokenAddress(mint, vaultPda, true);
          let uiAmount = 0;
          try {
            const r = await connection.getTokenAccountBalance(ata);
            uiAmount = r.value.uiAmount || 0;
          } catch { /* no vault ATA yet */ }
          return { ...t, ata: ata.toBase58(), uiAmount };
        })),
      ]);

      setSolBalance(lamports / LAMPORTS_PER_SOL);
      setTokens(walletRows);
      setVaultTokens(vaultRows);
    } catch (e) {
      console.error("[WalletPanel] balance refresh failed", e);
    }
  }, [publicKey, connection]);

  const refreshActivity = useCallback(async () => {
    if (!publicKey || !connection) return;
    setLoadingActivity(true);
    try {
      const sigs = await connection.getSignaturesForAddress(publicKey, { limit: 10 });
      setActivity(sigs.map((s) => ({
        signature: s.signature,
        slot: s.slot,
        blockTime: s.blockTime,
        err: s.err,
        memo: s.memo,
      })));
    } catch (e) {
      console.error("[WalletPanel] activity refresh failed", e);
    } finally {
      setLoadingActivity(false);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    refresh();
    refreshActivity();
    const id1 = setInterval(refresh, 15000);
    const id2 = setInterval(refreshActivity, 30000);
    return () => { clearInterval(id1); clearInterval(id2); };
  }, [refresh, refreshActivity]);

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  };

  if (!publicKey) {
    return (
      <div className="setup-card" style={{ gridColumn: "1 / -1" }}>
        <div className="setup-card-title">
          <Wallet size={16} color="var(--cyan)" /> Wallet
        </div>
        <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text3)", fontSize: 13 }}>
          Connect your wallet to view balances and activity.
        </div>
      </div>
    );
  }

  const pubStr = publicKey.toBase58();

  return (
    <div className="setup-card" style={{ gridColumn: "1 / -1" }}>
      <div className="setup-card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Wallet size={16} color="var(--cyan)" /> Wallet ({CLUSTER})
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { refresh(); refreshActivity(); }}
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Address row */}
      <div style={{
        background: "var(--bg3)", borderRadius: 14, padding: "14px 18px", marginBottom: 14,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", color: "var(--text3)", marginBottom: 4 }}>
            Address
          </div>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, color: "var(--text)", wordBreak: "break-all" }}>
            {pubStr}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => copy(pubStr, "addr")}
            title="Copy address"
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            {copied === "addr" ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
          </button>
          <a
            className="btn btn-ghost btn-sm"
            href={explorerAddressUrl(pubStr)} target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}
          >
            <ExternalLink size={12} /> Explorer
          </a>
        </div>
      </div>

      {/* Balances grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 16 }}>
        {/* Native SOL */}
        <div style={{ background: "var(--bg3)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text)" }}>SOL</span>
            <span style={{ fontSize: 9, color: "var(--text3)" }}>native</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "'Space Mono',monospace", color: "var(--text)" }}>
            {solBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </div>
          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4 }}>used for gas + rent</div>
        </div>

        {/* SPL tokens */}
        {tokens.map((t) => (
          <div key={t.mint} style={{ background: "var(--bg3)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text)" }}>{t.name}</span>
              <a href={explorerAddressUrl(t.mint)} target="_blank" rel="noreferrer"
                style={{ fontSize: 9, color: "var(--text3)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}
                title={t.mint}
              >
                {shortAddr(t.mint)} <ExternalLink size={9} />
              </a>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "'Space Mono',monospace", color: t.uiAmount > 0 ? "var(--text)" : "var(--text3)" }}>
              {t.uiAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </div>
            <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
              <span>ATA</span>
              <a href={explorerAddressUrl(t.ata)} target="_blank" rel="noreferrer"
                style={{ color: "var(--text3)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}
                title={t.ata}
              >
                {shortAddr(t.ata)} <ExternalLink size={9} />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Vault holdings — what's actually in the vault PDA (where bot profits land) */}
      <div style={{
        background: "linear-gradient(180deg, rgba(34,197,94,.04), transparent)",
        border: "1px solid rgba(34,197,94,.2)", borderRadius: 14,
        padding: "16px 18px", marginBottom: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800 }}>
            <Lock size={13} color="var(--green)" /> Vault holdings
            <span style={{ fontSize: 10, color: "var(--text3)", fontWeight: 600 }}>
              — bot trades land here
            </span>
          </span>
          {vaultPdaStr && (
            <a href={explorerAddressUrl(vaultPdaStr)} target="_blank" rel="noreferrer"
              style={{ fontSize: 10, color: "var(--text3)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
              title={vaultPdaStr}
            >
              PDA: {shortAddr(vaultPdaStr)} <ExternalLink size={9} />
            </a>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {vaultTokens.length === 0 ? (
            <div style={{ color: "var(--text3)", fontSize: 11 }}>Loading vault holdings…</div>
          ) : vaultTokens.map((t) => {
            const positive = t.uiAmount > 0;
            return (
              <div key={t.mint} style={{
                background: "var(--bg3)", borderRadius: 12, padding: "14px 16px",
                border: positive ? "1px solid rgba(34,197,94,.3)" : "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: positive ? "var(--green)" : "var(--text)", display: "flex", alignItems: "center", gap: 4 }}>
                    {positive && <TrendingUp size={11} />} {t.name}
                  </span>
                  <span style={{ fontSize: 9, color: "var(--text3)" }}>vault</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "'Space Mono',monospace", color: positive ? "var(--green)" : "var(--text3)" }}>
                  {t.uiAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </div>
                <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                  <span>vault ATA</span>
                  <a href={explorerAddressUrl(t.ata)} target="_blank" rel="noreferrer"
                    style={{ color: "var(--text3)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}
                    title={t.ata}
                  >
                    {shortAddr(t.ata)} <ExternalLink size={9} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 10, lineHeight: 1.5 }}>
          These are the SPL token accounts owned by your vault PDA on-chain. When a trade
          succeeds, the profit lands here — not in your Phantom wallet. Click <strong>Withdraw</strong>
          {" "}in the Vault panel below to pull funds back into your wallet.
        </div>
      </div>

      {/* Recent activity */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
          <Activity size={12} color="var(--v2)" /> Recent activity
        </span>
        {loadingActivity && <span style={{ fontSize: 10, color: "var(--text3)" }}>loading…</span>}
      </div>
      {activity.length === 0 && !loadingActivity && (
        <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text3)", fontSize: 12 }}>
          No transactions yet on this wallet.
        </div>
      )}
      {activity.length > 0 && (
        <div style={{ background: "var(--bg3)", borderRadius: 12, overflow: "hidden" }}>
          {activity.map((a) => {
            const time = a.blockTime ? new Date(a.blockTime * 1000) : null;
            const ago = time ? `${time.toLocaleTimeString()} · ${time.toLocaleDateString()}` : `slot ${a.slot}`;
            const failed = !!a.err;
            return (
              <a
                key={a.signature}
                href={explorerTxUrl(a.signature)} target="_blank" rel="noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", textDecoration: "none",
                  borderBottom: "1px solid var(--border)",
                  color: "var(--text2)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: 3,
                    background: failed ? "var(--red)" : "var(--green)",
                    boxShadow: `0 0 6px ${failed ? "var(--red)" : "var(--green)"}`,
                    flexShrink: 0,
                  }} />
                  <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {shortAddr(a.signature, 8, 8)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: "var(--text3)" }}>
                  <span>{ago}</span>
                  <ExternalLink size={11} />
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
