import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, CheckCircle, AlertTriangle, Wallet, Plus } from "lucide-react";
import {
  buildDepositTx,
  buildWithdrawTx,
  buildCreateVaultTx,
  getVaultBalance,
  getUserTokenBalance,
  getVaultStats,
  vaultExists,
  formatVaultError,
  FUSDC_MINT,
  FUSDC_DECIMALS,
} from "../lib/vault_client";

const TOKEN_MINT = FUSDC_MINT.toBase58();

export default function VaultPanel({ userId }) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [vaultBalance, setVaultBalance] = useState(null);
  const [userBalance, setUserBalance] = useState(0);
  const [hasVault, setHasVault] = useState(null); // null = unknown, true/false after check
  const [stats, setStats] = useState({ totalDeposits: 0, totalWithdrawals: 0 });
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [loading, setLoading] = useState(null); // "deposit" | "withdraw" | "create" | null
  const [result, setResult] = useState(null);

  const refreshAll = useCallback(async () => {
    if (!publicKey || !connection) return;
    try {
      const [exists, vBal, uBal, vStats] = await Promise.all([
        vaultExists(connection, publicKey),
        getVaultBalance(connection, publicKey, TOKEN_MINT),
        getUserTokenBalance(connection, publicKey, TOKEN_MINT),
        getVaultStats(connection, publicKey),
      ]);
      setHasVault(exists);
      setVaultBalance(vBal);
      setUserBalance(uBal);
      setStats({ totalDeposits: vStats.totalDeposits, totalWithdrawals: vStats.totalWithdrawals });
    } catch (e) {
      console.error("[VaultPanel] refresh failed", e);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 15000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  const handleCreateVault = async () => {
    if (!publicKey || loading) return;
    setLoading("create");
    setResult(null);
    try {
      const tx = await buildCreateVaultTx(connection, publicKey);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      setResult({ type: "success", msg: `Vault created. Tx: ${sig.slice(0, 8)}...` });
      refreshAll();
    } catch (err) {
      console.error("[createVault]", err);
      setResult({ type: "error", msg: formatVaultError(err) });
    } finally {
      setLoading(null);
    }
  };

  const handleDeposit = async () => {
    if (!publicKey || !depositAmount || loading) return;
    if (userBalance <= 0) {
      setResult({ type: "error", msg: `0 fUSDC in wallet. Mint test fUSDC first: scripts/devnet/mint_fusdc_to.ts ${publicKey.toBase58()} 1000` });
      return;
    }
    setLoading("deposit");
    setResult(null);
    try {
      const rawAmount = Math.round(parseFloat(depositAmount) * 10 ** FUSDC_DECIMALS);
      const tx = await buildDepositTx(connection, publicKey, TOKEN_MINT, rawAmount);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      setResult({ type: "success", msg: `Deposited ${depositAmount} fUSDC. Tx: ${sig.slice(0, 8)}...` });
      setDepositAmount("");
      refreshAll();
    } catch (err) {
      console.error("[deposit]", err);
      setResult({ type: "error", msg: formatVaultError(err) });
    } finally {
      setLoading(null);
    }
  };

  const handleWithdraw = async () => {
    if (!publicKey || !withdrawAmount || loading) return;
    setLoading("withdraw");
    setResult(null);
    try {
      const rawAmount = Math.round(parseFloat(withdrawAmount) * 10 ** FUSDC_DECIMALS);
      const tx = await buildWithdrawTx(connection, publicKey, TOKEN_MINT, rawAmount);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      setResult({ type: "success", msg: `Withdrew ${withdrawAmount} fUSDC. Tx: ${sig.slice(0, 8)}...` });
      setWithdrawAmount("");
      refreshAll();
    } catch (err) {
      console.error("[withdraw]", err);
      setResult({ type: "error", msg: formatVaultError(err) });
    } finally {
      setLoading(null);
    }
  };

  if (!publicKey) {
    return (
      <div className="setup-card" style={{ gridColumn: "1 / -1" }}>
        <div className="setup-card-title">
          <Wallet size={16} color="var(--v2)" /> Vault
        </div>
        <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text3)", fontSize: 13 }}>
          Connect your wallet to manage vault funds.
        </div>
      </div>
    );
  }

  return (
    <div className="setup-card" style={{ gridColumn: "1 / -1" }}>
      <div className="setup-card-title">
        <Wallet size={16} color="var(--v2)" /> Vault — Deposit & Withdraw
      </div>

      {/* Vault balance + Profit row */}
      {(() => {
        const vBalance = vaultBalance?.uiAmount ?? 0;
        const profit = vBalance - (stats.totalDeposits - stats.totalWithdrawals);
        const profitPositive = profit >= 0;
        const profitColor = profitPositive ? "var(--green)" : "var(--red)";
        const profitSign = profitPositive ? "+" : "";
        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ background: "var(--bg3)", borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", color: "var(--text3)", marginBottom: 4 }}>
                Vault balance (fUSDC)
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text)", fontFamily: "'Space Mono',monospace" }}>
                {vaultBalance ? vBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
                Wallet: {userBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} fUSDC · {hasVault === false ? "Vault not created" : hasVault === true ? "PDA-secured" : "Loading..."}
              </div>
            </div>
            <div style={{ background: "var(--bg3)", borderRadius: 14, padding: "18px 20px", border: `1px solid ${profitColor}33` }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", color: "var(--text3)", marginBottom: 4 }}>
                Profit earned
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: profitColor, fontFamily: "'Space Mono',monospace" }}>
                {hasVault ? `${profitSign}${profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
                Deposited {stats.totalDeposits.toFixed(2)} · Withdrawn {stats.totalWithdrawals.toFixed(2)}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Create Vault step (only when missing) */}
      {hasVault === false && (
        <div style={{ background: "var(--bg3)", borderRadius: 14, padding: "18px 20px", marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 10, lineHeight: 1.6 }}>
            You don't have a vault yet. Create it once — Phantom will sign a small transaction.
            After that you'll be able to deposit fUSDC.
          </div>
          <button
            className="btn btn-v"
            onClick={handleCreateVault}
            disabled={!!loading}
            style={{
              width: "100%", borderRadius: 10, justifyContent: "center",
              opacity: loading ? 0.5 : 1,
              background: "var(--v2)", borderColor: "var(--v2)",
            }}
          >
            {loading === "create" ? (
              <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Creating vault...</>
            ) : (
              <><Plus size={14} /> Create Vault</>
            )}
          </button>
        </div>
      )}

      {/* Deposit / Withdraw row */}
      {hasVault && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Deposit */}
          <div style={{ background: "var(--bg3)", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--green)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <ArrowDownToLine size={14} /> Deposit
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                className="num-inp"
                type="number"
                placeholder="Amount"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                disabled={!!loading}
                style={{ flex: 1, marginTop: 0, marginBottom: 0 }}
              />
            </div>
            <button
              className="btn btn-v"
              onClick={handleDeposit}
              disabled={!depositAmount || !!loading}
              style={{
                width: "100%", borderRadius: 10, justifyContent: "center",
                opacity: !depositAmount || loading ? 0.5 : 1,
                background: "var(--green)", borderColor: "var(--green)",
              }}
            >
              {loading === "deposit" ? (
                <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Depositing...</>
              ) : (
                <><ArrowDownToLine size={14} /> Deposit</>
              )}
            </button>
          </div>

          {/* Withdraw */}
          <div style={{ background: "var(--bg3)", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--gold)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <ArrowUpFromLine size={14} /> Withdraw
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                className="num-inp"
                type="number"
                placeholder="Amount"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                disabled={!!loading}
                style={{ flex: 1, marginTop: 0, marginBottom: 0 }}
              />
            </div>
            <button
              className="btn btn-v"
              onClick={handleWithdraw}
              disabled={!withdrawAmount || !!loading}
              style={{
                width: "100%", borderRadius: 10, justifyContent: "center",
                opacity: !withdrawAmount || loading ? 0.5 : 1,
                background: "var(--gold)", borderColor: "var(--gold)",
              }}
            >
              {loading === "withdraw" ? (
                <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Withdrawing...</>
              ) : (
                <><ArrowUpFromLine size={14} /> Withdraw</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Result message */}
      {result && (
        <div style={{
          marginTop: 12, padding: "10px 14px", borderRadius: 10,
          background: result.type === "success" ? "var(--green2)" : "rgba(239,68,68,.1)",
          border: `1px solid ${result.type === "success" ? "var(--green)" : "var(--red)"}33`,
          fontSize: 12, color: result.type === "success" ? "var(--green)" : "var(--red)",
          display: "flex", alignItems: "flex-start", gap: 8, wordBreak: "break-word",
        }}>
          {result.type === "success" ? <CheckCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} /> : <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />}
          <span style={{ whiteSpace: "pre-wrap" }}>{result.msg}</span>
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 12, lineHeight: 1.6 }}>
        Your funds are held in a program-owned vault PDA. Only you can withdraw. The bot can only trade within the vault — it cannot transfer funds out.
      </div>
    </div>
  );
}
