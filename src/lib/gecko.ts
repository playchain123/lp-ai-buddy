// Live market data helpers for charts, trades, and token icons.
const BASE = "https://api.geckoterminal.com/api/v2";
const METEORA_DAMM_BASE = "https://damm-v2.datapi.meteora.ag";

export type Tf = "minute" | "hour" | "day";
export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

export type MarketTf = "30m" | "1h" | "4h" | "1d";

const GECKO_TF_MAP: Record<MarketTf, { tf: Tf; aggregate: number }> = {
  "30m": { tf: "minute", aggregate: 30 },
  "1h": { tf: "hour", aggregate: 1 },
  "4h": { tf: "hour", aggregate: 4 },
  "1d": { tf: "day", aggregate: 1 },
};

function normalizeCandle(row: any): Candle | null {
  if (Array.isArray(row) && row.length >= 6) {
    return { t: Number(row[0]) * 1000, o: +row[1], h: +row[2], l: +row[3], c: +row[4], v: +row[5] };
  }
  if (!row || typeof row !== "object") return null;

  const ts = Number(row.time ?? row.timestamp ?? row.t ?? row.start_time ?? row.open_time ?? 0);
  const open = Number(row.open ?? row.o ?? 0);
  const high = Number(row.high ?? row.h ?? 0);
  const low = Number(row.low ?? row.l ?? 0);
  const close = Number(row.close ?? row.c ?? 0);
  const volume = Number(row.volume ?? row.v ?? 0);

  if (!ts || [open, high, low, close].some((n) => !Number.isFinite(n))) return null;
  return { t: ts > 1e12 ? ts : ts * 1000, o: open, h: high, l: low, c: close, v: Number.isFinite(volume) ? volume : 0 };
}

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

export async function livePoolOhlcv(pool: string, timeframe: MarketTf, limit = 120): Promise<Candle[]> {
  const meteoraUrl = `${METEORA_DAMM_BASE}/pools/${pool}/ohlcv?timeframe=${timeframe}&limit=${limit}`;

  try {
    const res = await fetch(meteoraUrl, { headers: { Accept: "application/json" } });
    if (res.ok) {
      const json = await res.json();
      const rows: any[] = json?.data || [];
      const candles = rows.map(normalizeCandle).filter(Boolean) as Candle[];
      if (candles.length) return candles.sort((a, b) => a.t - b.t);
    }
  } catch {
    // fallback below
  }

  const fallback = GECKO_TF_MAP[timeframe];
  return gtOhlcv(pool, fallback.tf, fallback.aggregate, limit);
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
