// Central source of truth for cluster + explorer + tracked tokens.
// Flip CLUSTER to "mainnet-beta" when migrating off devnet — every panel
// that links to the explorer or shows token balances will follow.

export const CLUSTER = "devnet";

export const EXPLORER_BASE = "https://explorer.solana.com";

export const explorerTxUrl = (sig) =>
  `${EXPLORER_BASE}/tx/${sig}${CLUSTER === "mainnet-beta" ? "" : `?cluster=${CLUSTER}`}`;

export const explorerAddressUrl = (addr) =>
  `${EXPLORER_BASE}/address/${addr}${CLUSTER === "mainnet-beta" ? "" : `?cluster=${CLUSTER}`}`;

// Tracked SPL tokens shown in the Wallet panel. On devnet these are the
// project's synthetic mints (matches config/devnet_tokens.json on the bot).
// On mainnet, replace with real mints (USDC, wSOL, etc.).
export const TRACKED_TOKENS =
  CLUSTER === "mainnet-beta"
    ? [
        { name: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
        { name: "wSOL", mint: "So11111111111111111111111111111111111111112", decimals: 9 },
      ]
    : [
        { name: "fUSDC", mint: "BzhYAzTEE929v5SYbCSFC6hF9oDUqPmM1sjHJ7a5tHMN", decimals: 6 },
        { name: "fSOL",  mint: "2BtDtoFDsLNxYs4auSYyBbDC7xbxUcoNdR8Qw1PVNzpC", decimals: 9 },
        { name: "fRAY",  mint: "7CvVkbvjKu4Jj5tGpfKtL1EpRQdyXAJoGCCHU9drgMxh", decimals: 6 },
      ];

export const shortAddr = (addr, head = 4, tail = 4) =>
  !addr ? "" : addr.length <= head + tail + 3 ? addr : `${addr.slice(0, head)}...${addr.slice(-tail)}`;
