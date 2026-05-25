import { getToken } from "./auth";

const API_BASE = "http://localhost:3001";
const WS_URL = "ws://localhost:3001/ws";

// Build headers with the Bearer token (if signed in). Used on all per-user
// (owned) endpoints so the backend's authenticate + requireOwner pass.
function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ── REST API calls ────────────────────────────────────────

export async function apiHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function apiStartBot(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}/start`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
  });
  return res.json();
}

export async function apiStopBot(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}/stop`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
  });
  return res.json();
}

export async function apiGetStatus(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}/status`, {
    headers: authHeaders(),
  });
  return res.json();
}

export async function apiGetConfig(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}/config`, {
    headers: authHeaders(),
  });
  return res.json();
}

export async function apiSaveConfig(userId, config) {
  const res = await fetch(`${API_BASE}/users/${userId}/config`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function apiListUsers() {
  const res = await fetch(`${API_BASE}/users`);
  return res.json();
}

export async function apiGetTrades(userId, date) {
  const params = date ? `?date=${date}` : "";
  const res = await fetch(`${API_BASE}/users/${userId}/trades${params}`, {
    headers: authHeaders(),
  });
  return res.json();
}

// ── Market data (no auth needed) ─────────────────────────

export async function apiGetMarket() {
  const res = await fetch(`${API_BASE}/market`);
  return res.json();
}

export async function apiGetNews() {
  const res = await fetch(`${API_BASE}/news`);
  return res.json();
}

export function createMarketSocket(onTick) {
  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "subscribe_market" }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "tick" && onTick) onTick(msg.data);
    if (msg.type === "subscribed_market") {
      console.log("Subscribed to market feed (viewer)");
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };

  return { close: () => ws.close() };
}

// ── WebSocket connection ──────────────────────────────────

export function createTickSocket(userId, onTick, onStatus) {
  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    // Include the JWT so the backend can enforce ownership on the stream
    // (no-op in devnet bypass mode where the token is absent).
    ws.send(JSON.stringify({ type: "subscribe", userId, token: getToken() }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "tick" && onTick) onTick(msg.data);
    if (msg.type === "status" && onStatus) onStatus(msg.data);
    if (msg.type === "subscribed") {
      console.log(`Subscribed to tick feed for ${userId}`);
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };

  return {
    close: () => ws.close(),
    requestStatus: () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "status", userId }));
      }
    },
  };
}
