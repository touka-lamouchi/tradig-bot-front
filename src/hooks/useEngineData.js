import { useState, useEffect, useRef, useCallback } from "react";
import { apiGetStatus, apiGetTrades, apiGetMarket, createTickSocket, createMarketSocket } from "../lib/api";

// Module-level cache: survives unmount/remount when switching tabs, so KPIs
// don't blank out on every nav click while we wait for the next 5s poll.
const cache = {
  statusByKey: new Map(),  // key = userId | "viewer"
  tradesByUser: new Map(),
  ticksByKey: new Map(),
  marketByKey: new Map(),
};

// Stable identity for a trade — prefer signature, fall back to timestamp+pool.
const tradeKey = (t) => t?.signature || `${t?.timestamp ?? ""}:${t?.pool ?? ""}`;

// Merge two trade lists by key, preserving order (incoming wins on conflict).
const mergeTrades = (existing, incoming) => {
  const map = new Map();
  for (const t of existing) map.set(tradeKey(t), t);
  for (const t of incoming) map.set(tradeKey(t), t);
  return Array.from(map.values()).sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
};

/**
 * Hook to get real-time engine data.
 *
 * Two modes:
 * - userId provided → authenticated user, polls status + trades, subscribes to user tick feed
 * - userId null + viewer=true → no wallet, polls /market, subscribes to market feed
 */
export function useEngineData(userId, { viewer = false } = {}) {
  const cacheKey = viewer ? "viewer" : userId || null;
  const [status, setStatus] = useState(() => (cacheKey ? cache.statusByKey.get(cacheKey) ?? null : null));
  const [ticks, setTicks] = useState(() => (cacheKey ? cache.ticksByKey.get(cacheKey) ?? [] : []));
  const [trades, setTrades] = useState(() => (userId ? cache.tradesByUser.get(userId) ?? [] : []));
  const [market, setMarket] = useState(() => (cacheKey ? cache.marketByKey.get(cacheKey) ?? null : null));
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  // Poll status (user mode) or market (viewer mode)
  useEffect(() => {
    if (viewer) {
      const poll = async () => {
        try {
          const m = await apiGetMarket();
          setStatus(m);
          cache.statusByKey.set("viewer", m);
          if (m?.market) {
            setMarket(m.market);
            cache.marketByKey.set("viewer", m.market);
          }
        } catch { /* API not reachable */ }
      };
      poll();
      const interval = setInterval(poll, 5000);
      return () => clearInterval(interval);
    }

    if (!userId) return;

    const poll = async () => {
      try {
        const s = await apiGetStatus(userId);
        setStatus(s);
        cache.statusByKey.set(userId, s);
        if (s?.market) {
          setMarket(s.market);
          cache.marketByKey.set(userId, s.market);
        }
      } catch { /* API not reachable */ }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [userId, viewer]);

  // Poll trades (user mode only)
  useEffect(() => {
    if (!userId || viewer) return;

    const fetchTrades = async () => {
      try {
        const t = await apiGetTrades(userId);
        if (Array.isArray(t)) {
          setTrades((prev) => {
            const merged = mergeTrades(prev, t);
            cache.tradesByUser.set(userId, merged);
            return merged;
          });
        }
      } catch { /* API not reachable */ }
    };

    fetchTrades();
    const interval = setInterval(fetchTrades, 30000);
    return () => clearInterval(interval);
  }, [userId, viewer]);

  // WebSocket subscription
  useEffect(() => {
    if (viewer) {
      // Viewer: subscribe to market feed
      const socket = createMarketSocket((tickData) => {
        setTicks((prev) => {
          const next = [...prev.slice(-49), tickData];
          cache.ticksByKey.set("viewer", next);
          return next;
        });
        if (tickData.type === "scan_complete" && tickData.market) {
          setMarket(tickData.market);
          cache.marketByKey.set("viewer", tickData.market);
        }
        setConnected(true);
      });
      wsRef.current = socket;
      return () => { socket.close(); wsRef.current = null; };
    }

    if (!userId) return;

    const socket = createTickSocket(
      userId,
      (tickData) => {
        setTicks((prev) => {
          const next = [...prev.slice(-49), tickData];
          cache.ticksByKey.set(userId, next);
          return next;
        });
        if (tickData.type === "trade_executed") {
          const incoming = {
            timestamp: tickData.timestamp,
            pool: tickData.pool,
            pair: tickData.pair,
            profit: tickData.profit || 0,
            signature: tickData.signature || "",
            oppType: tickData.oppType || "unknown",
            // Production Arbitrage Phase 4: surface generic cycle metadata
            cyclePath: Array.isArray(tickData.cyclePath) ? tickData.cyclePath : null,
            hops: typeof tickData.hops === "number" ? tickData.hops : null,
          };
          setTrades((prev) => {
            const key = tradeKey(incoming);
            if (prev.some((t) => tradeKey(t) === key)) return prev;
            const next = [...prev, incoming];
            cache.tradesByUser.set(userId, next);
            return next;
          });
        }
        if (tickData.type === "scan_complete" && tickData.market) {
          setMarket(tickData.market);
          cache.marketByKey.set(userId, tickData.market);
        }
        setConnected(true);
      },
      (statusData) => {
        if (statusData) {
          setStatus(statusData);
          cache.statusByKey.set(userId, statusData);
        }
      }
    );
    wsRef.current = socket;

    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [userId, viewer]);

  const clearTicks = useCallback(() => setTicks([]), []);

  return { status, ticks, trades, market, connected, clearTicks };
}
