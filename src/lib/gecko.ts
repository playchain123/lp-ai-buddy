// GeckoTerminal public API — no key, CORS friendly. Used for OHLCV + recent trades.
const BASE = "https://api.geckoterminal.com/api/v2";

export type Tf = "minute" | "hour" | "day";
export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

export async function gtOhlcv(pool: string, timeframe: Tf, aggregate: number, limit = 120): Promise<Candle[]> {
  const url = `${BASE}/networks/solana/pools/${pool}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const j = await r.json();
  const list: any[] = j?.data?.attributes?.ohlcv_list || [];
  // [ts, open, high, low, close, volume] (newest first) — flip
  return list
    .map((row) => ({ t: row[0] * 1000, o: +row[1], h: +row[2], l: +row[3], c: +row[4], v: +row[5] }))
    .sort((a, b) => a.t - b.t);
}

export type Trade = {
  id: string; ts: number; kind: "buy" | "sell"; volumeUsd: number;
  fromAmount: number; toAmount: number; wallet: string; tx: string;
};

export async function gtTrades(pool: string, minUsd = 0): Promise<Trade[]> {
  const url = `${BASE}/networks/solana/pools/${pool}/trades${minUsd > 0 ? `?trade_volume_in_usd_greater_than=${minUsd}` : ""}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const j = await r.json();
  const list: any[] = j?.data || [];
  return list.map((t) => ({
    id: t.id,
    ts: new Date(t.attributes.block_timestamp).getTime(),
    kind: t.attributes.kind,
    volumeUsd: +t.attributes.volume_in_usd,
    fromAmount: +t.attributes.from_token_amount,
    toAmount: +t.attributes.to_token_amount,
    wallet: t.attributes.tx_from_address,
    tx: t.attributes.tx_hash,
  }));
}

// Multi-source icon resolver — Jupiter image proxy works for almost every Solana mint.
export const tokenIcon = (mint?: string) =>
  mint ? `https://img.jup.ag/${mint}` : undefined;
export const tokenIconFallbacks = (mint?: string) => mint ? [
  `https://img.jup.ag/${mint}`,
  `https://wsrv.nl/?url=https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png&w=64&h=64`,
  `https://wsrv.nl/?url=https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${mint}/logo.png&w=64&h=64`,
  `https://wsrv.nl/?url=https://static.jup.ag/coins/${mint}.png&w=64&h=64`,
] : [];
