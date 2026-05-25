import { useEffect, useState } from "react";

const TOKENS = [
  { sym: "SOL",  id: "solana" },
  { sym: "BTC",  id: "bitcoin" },
  { sym: "ETH",  id: "ethereum" },
  { sym: "BNB",  id: "binancecoin" },
  { sym: "JUP",  id: "jupiter-exchange-solana" },
  { sym: "WIF",  id: "dogwifcoin" },
  { sym: "BONK", id: "bonk" },
  { sym: "PYTH", id: "pyth-network" },
];

const FALLBACK = TOKENS.map(t => ({ sym: t.sym, price: "—", chg: "0.0%", up: true }));

const ENDPOINT =
  "https://api.coingecko.com/api/v3/simple/price?ids=" +
  TOKENS.map(t => t.id).join(",") +
  "&vs_currencies=usd&include_24hr_change=true";

function formatPrice(p) {
  if (p == null || Number.isNaN(p)) return "—";
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 1)    return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(3);
  return p.toPrecision(3);
}

export default function useLivePrices(intervalMs = 30_000) {
  const [prices, setPrices] = useState(FALLBACK);

  useEffect(() => {
    let cancelled = false;

    async function fetchPrices() {
      try {
        const res = await fetch(ENDPOINT);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const next = TOKENS.map(t => {
          const row = data[t.id];
          const price = row?.usd;
          const chg = row?.usd_24h_change ?? 0;
          return {
            sym: t.sym,
            price: formatPrice(price),
            chg: `${chg >= 0 ? "+" : ""}${chg.toFixed(1)}%`,
            up: chg >= 0,
          };
        });
        setPrices(next);
      } catch (err) {
        console.warn("ticker fetch failed:", err);
      }
    }

    fetchPrices();
    const id = setInterval(fetchPrices, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [intervalMs]);

  return prices;
}
