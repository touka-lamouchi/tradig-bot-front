// Sign-In With Solana (SIWS) client.
//
// Pairs with the backend /auth/nonce + /auth/verify endpoints. Proves wallet
// ownership by signing a server-issued nonce with Phantom, then stores the
// returned JWT for use as a Bearer token on every API call.
//
// The token is kept in sessionStorage (cleared when the tab closes) rather than
// localStorage to reduce XSS token-theft blast radius.

import bs58 from "bs58";

const API_BASE = "http://localhost:3001";
const TOKEN_KEY = "siws_jwt";
const PUBKEY_KEY = "siws_pubkey";

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getAuthedPubkey() {
  return sessionStorage.getItem(PUBKEY_KEY);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(PUBKEY_KEY);
}

export function isAuthed(pubkey) {
  return !!getToken() && getAuthedPubkey() === pubkey;
}

/**
 * Run the full SIWS handshake for a connected wallet.
 * @param {string} pubkey  base58 wallet address
 * @param {(msg: Uint8Array) => Promise<{signature: Uint8Array}>} signMessage
 *        the wallet adapter's signMessage fn
 * @returns {Promise<string>} the JWT
 */
export async function signIn(pubkey, signMessage) {
  // 1. Ask the server for a nonce message.
  const nonceRes = await fetch(
    `${API_BASE}/auth/nonce?pubkey=${encodeURIComponent(pubkey)}`
  );
  if (!nonceRes.ok) throw new Error("Failed to get nonce");
  const { message } = await nonceRes.json();

  // 2. Sign it with the wallet (no transaction, no fee).
  const encoded = new TextEncoder().encode(message);
  const { signature } = await signMessage(encoded);
  const signatureB58 = bs58.encode(signature);

  // 3. Exchange the signature for a JWT.
  const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pubkey, signature: signatureB58 }),
  });
  if (!verifyRes.ok) throw new Error("Signature verification failed");
  const { token } = await verifyRes.json();

  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(PUBKEY_KEY, pubkey);
  return token;
}
