import { PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Buffer } from "buffer";

// Real deployed devnet program + token
export const VAULT_PROGRAM_ID = new PublicKey("Gw6USbf98yEjLLFa9aTeNpQjAvRjuZ2576AVvu3B1g6H");
export const FUSDC_MINT = new PublicKey("BzhYAzTEE929v5SYbCSFC6hF9oDUqPmM1sjHJ7a5tHMN");
export const BOT_PUBKEY = new PublicKey("BbZigWthEaoCxD4M9aaGw19RP1geVugUXk1DMehLPrLz");
export const FUSDC_DECIMALS = 6;

// Anchor instruction discriminators (from programs_vault.json IDL)
const DISC_CREATE_VAULT = Buffer.from([29, 237, 247, 208, 193, 82, 54, 135]);
const DISC_DEPOSIT = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);
const DISC_WITHDRAW = Buffer.from([183, 18, 70, 156, 148, 109, 161, 34]);

function encodeU64LE(amount) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(amount), 0);
  return buf;
}

export function deriveVaultPDA(userPubkey) {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_vault"), userPubkey.toBytes()],
    VAULT_PROGRAM_ID,
  );
  return { pda, bump };
}

export async function vaultExists(connection, userPubkey) {
  const { pda } = deriveVaultPDA(userPubkey);
  const info = await connection.getAccountInfo(pda);
  return info !== null;
}

export async function buildCreateVaultTx(connection, userPubkey) {
  const { pda } = deriveVaultPDA(userPubkey);

  const data = Buffer.concat([DISC_CREATE_VAULT, BOT_PUBKEY.toBuffer()]);

  const ix = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: userPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = userPubkey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return tx;
}

export async function buildDepositTx(connection, userPubkey, tokenMint, rawAmount) {
  const mint = new PublicKey(tokenMint);
  const { pda: vaultPda } = deriveVaultPDA(userPubkey);
  const userToken = await getAssociatedTokenAddress(mint, userPubkey);
  const vaultToken = await getAssociatedTokenAddress(mint, vaultPda, true);

  const data = Buffer.concat([DISC_DEPOSIT, encodeU64LE(rawAmount)]);

  const ix = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: userToken, isSigner: false, isWritable: true },
      { pubkey: vaultToken, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: userPubkey, isSigner: true, isWritable: true },
      { pubkey: userPubkey, isSigner: false, isWritable: false }, // owner = user (vault.owner = user)
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = userPubkey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return tx;
}

export async function buildWithdrawTx(connection, userPubkey, tokenMint, rawAmount) {
  const mint = new PublicKey(tokenMint);
  const { pda: vaultPda } = deriveVaultPDA(userPubkey);
  const userToken = await getAssociatedTokenAddress(mint, userPubkey);
  const vaultToken = await getAssociatedTokenAddress(mint, vaultPda, true);

  const data = Buffer.concat([DISC_WITHDRAW, encodeU64LE(rawAmount)]);

  const ix = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: vaultToken, isSigner: false, isWritable: true },
      { pubkey: userToken, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: userPubkey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = userPubkey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return tx;
}

export async function getVaultBalance(connection, userPubkey, tokenMint) {
  const mint = new PublicKey(tokenMint);
  const { pda: vaultPda } = deriveVaultPDA(userPubkey);
  const vaultToken = await getAssociatedTokenAddress(mint, vaultPda, true);

  try {
    const balance = await connection.getTokenAccountBalance(vaultToken);
    return {
      amount: balance.value.amount,
      decimals: balance.value.decimals,
      uiAmount: balance.value.uiAmount || 0,
    };
  } catch {
    return { amount: "0", decimals: FUSDC_DECIMALS, uiAmount: 0 };
  }
}

// Read totalDeposits / totalWithdrawals directly from the UserVault account bytes.
// Layout: 8 disc + 32 owner + 32 bot + 1 bump + 8 created_at + 8 total_deposits
//       + 8 total_withdrawals + 8 total_trades + 1 is_active
export async function getVaultStats(connection, userPubkey) {
  const { pda } = deriveVaultPDA(userPubkey);
  const info = await connection.getAccountInfo(pda);
  if (!info || info.data.length < 106) {
    return { exists: false, totalDeposits: 0, totalWithdrawals: 0, totalTrades: 0, isActive: false };
  }
  const data = Buffer.from(info.data);
  const totalDepositsRaw = data.readBigUInt64LE(81);
  const totalWithdrawalsRaw = data.readBigUInt64LE(89);
  const totalTradesRaw = data.readBigUInt64LE(97);
  const isActive = data.readUInt8(105) === 1;
  const div = 10 ** FUSDC_DECIMALS;
  return {
    exists: true,
    totalDeposits: Number(totalDepositsRaw) / div,
    totalWithdrawals: Number(totalWithdrawalsRaw) / div,
    totalTrades: Number(totalTradesRaw),
    isActive,
  };
}

export async function getUserTokenBalance(connection, userPubkey, tokenMint) {
  const mint = new PublicKey(tokenMint);
  const userToken = await getAssociatedTokenAddress(mint, userPubkey);
  try {
    const balance = await connection.getTokenAccountBalance(userToken);
    return balance.value.uiAmount || 0;
  } catch {
    return 0;
  }
}

// Build a human-readable error message from a SendTransactionError or anchor error
export function formatVaultError(err) {
  if (!err) return "Unknown error";
  const logs = err.logs || err?.transactionLogs;
  if (Array.isArray(logs) && logs.length) {
    const programErr = logs.find((l) => l.includes("Error") || l.includes("failed"));
    if (programErr) return programErr;
    return logs[logs.length - 1];
  }
  return err.message || String(err);
}
