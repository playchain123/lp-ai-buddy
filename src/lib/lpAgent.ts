import { supabase } from "@/integrations/supabase/client";

export async function lp(action: string, params?: Record<string, any>, body?: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke("lp-proxy", {
    body: { action, params, body },
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error || "LP Agent error");
  return data.data;
}

export async function zapFn(op: string, payload: any) {
  const { data, error } = await supabase.functions.invoke("zap-execute", {
    body: { op, payload },
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error || "Zap error");
  return data.data;
}

export async function chatFn(messages: { role: string; content: string }[], wallet: string | null) {
  const { data, error } = await supabase.functions.invoke("chat", {
    body: { messages, wallet },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as { content: string; toolResults: any[] };
}

// LP Agent unwrap helpers — endpoints return { status, data } and sometimes { data: { data: [...] }}
export function unwrap<T = any>(res: any): T {
  if (res == null) return res;
  if (res?.data?.data !== undefined) return res.data.data as T;
  if (res?.data !== undefined) return res.data as T;
  return res as T;
}
// Overview returns an array with one row.
export function firstRow(res: any): any {
  const u = unwrap<any>(res);
  if (Array.isArray(u)) return u[0] ?? {};
  return u ?? {};
}
export function listRows(res: any): any[] {
  const u = unwrap<any>(res);
  if (Array.isArray(u)) return u;
  if (Array.isArray(u?.data)) return u.data;
  if (Array.isArray(u?.pools)) return u.pools;
  if (Array.isArray(u?.positions)) return u.positions;
  if (Array.isArray(u?.items)) return u.items;
  if (Array.isArray(u?.results)) return u.results;
  return [];
}

// Pull a value for a series of date-ranged metrics like { ALL, 7D, 1M, ... }
export function rangeVal(v: any, range = "ALL"): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "object") {
    if (range in v) return Number(v[range]);
    if ("ALL" in v) return Number(v.ALL);
  }
  return null;
}

// Format helpers
export const fmtUsd = (n: number | string | null | undefined, opts?: { compact?: boolean; digits?: number }) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || isNaN(v as number)) return "—";
  const num = v as number;
  if (opts?.compact && Math.abs(num) >= 1000) {
    if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  }
  return num.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: opts?.digits ?? 2 });
};

export const fmtPct = (n: number | string | null | undefined, digits = 2) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || isNaN(v as number)) return "—";
  return `${(v as number).toFixed(digits)}%`;
};

export const fmtNum = (n: any, d = 2) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || isNaN(v as number)) return "—";
  return (v as number).toLocaleString(undefined, { maximumFractionDigits: d });
};

export const shortAddr = (a?: string | null, n = 4) =>
  a ? `${a.slice(0, n)}…${a.slice(-n)}` : "";

export const poolAddress = (p: any) => pick(p, ["pool", "address", "poolAddress", "id", "poolId"]);

export const numberFrom = (obj: any, keys: string[], dflt: number | null = null) => {
  const value = pick(obj, keys);
  const parsed = typeof value === "string" ? Number(value.replace(/[$,%\s,]/g, "")) : Number(value);
  return Number.isFinite(parsed) ? parsed : dflt;
};

export const tokenFromInfo = (info: any, index: 0 | 1) =>
  pick(info, [`tokenInfo.${index}.data.0`], {}) || {};

export const poolMetric = (sources: any[], keys: string[], dflt: number | null = null) => {
  for (const source of sources) {
    const value = numberFrom(source, keys, null);
    if (value != null && value > 0) return value;
  }
  return dflt;
};

export const poolSymbols = (p: any) => {
  const info = p?.__info || p;
  const t0 = p?.__t0 || tokenFromInfo(info, 0);
  const t1 = p?.__t1 || tokenFromInfo(info, 1);
  return {
    token0: pick(p, ["token0_symbol", "token0.symbol", "tokenX.symbol", "baseToken.symbol"]) || t0?.symbol || "?",
    token1: pick(p, ["token1_symbol", "token1.symbol", "tokenY.symbol", "quoteToken.symbol"]) || t1?.symbol || "?",
    icon0: pick(p, ["token0_icon", "logo0", "__t0.icon"]) || t0?.icon,
    icon1: pick(p, ["token1_icon", "logo1", "__t1.icon"]) || t1?.icon,
  };
};

export const poolLabel = (p: any) => {
  const s = poolSymbols(p);
  return pick(p, ["pair", "name", "poolName"]) || `${s.token0} / ${s.token1}`;
};

export const extractTxBundle = (built: any) => {
  const d = built?.data || built;
  const swap = d?.swapTxsWithJito || d?.swapTxs || [];
  const add = d?.addLiquidityTxsWithJito || d?.addLiquidityTxs || [];
  const close = d?.closeTxsWithJito || d?.closeTxs || [];
  const txs = [...swap, ...add, ...close].filter(Boolean);
  return { d, swap, add, close, txs, lastValidBlockHeight: d?.lastValidBlockHeight };
};

// Best-effort field extraction from variable LP Agent shapes
export const pick = (obj: any, keys: string[], dflt: any = undefined) => {
  if (!obj) return dflt;
  for (const k of keys) {
    const parts = k.split(".");
    let cur: any = obj;
    let ok = true;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in cur) cur = cur[p]; else { ok = false; break; }
    }
    if (ok && cur != null) return cur;
  }
  return dflt;
};

export type Position = {
  id: string;
  pool: string;
  protocol: string;
  pair: string;
  t0: string;
  t1: string;
  logo0?: string;
  logo1?: string;
  currentValue: number;
  inputValue: number;
  pnl: number;
  pnlPct: number;
  fees: number;
  apr: number | null;
  inRange: boolean;
  ageHour: number;
  status: string;
  raw: any;
};

export function normalizePosition(p: any): Position {
  return {
    id: pick(p, ["tokenId", "position", "id", "positionId"]) || "",
    pool: pick(p, ["pool", "poolAddress"]) || "",
    protocol: pick(p, ["protocol", "type"]) || "meteora",
    pair: pick(p, ["pair", "pairName", "name"]) || `${pick(p, ["tokenName0", "token0Info.token_symbol"], "?")}/${pick(p, ["tokenName1", "token1Info.token_symbol"], "?")}`,
    t0: pick(p, ["tokenName0", "token0Info.token_symbol"], "?"),
    t1: pick(p, ["tokenName1", "token1Info.token_symbol"], "?"),
    logo0: pick(p, ["logo0", "token0Info.logo"]),
    logo1: pick(p, ["logo1", "token1Info.logo"]),
    currentValue: Number(pick(p, ["currentValue", "value", "valueUsd"], 0)) || 0,
    inputValue: Number(pick(p, ["inputValue", "value"], 0)) || 0,
    pnl: Number(pick(p, ["pnl.value", "pnl", "pnlUsd"], 0)) || 0,
    pnlPct: Number(pick(p, ["pnl.percent", "pnlPercent"], 0)) || 0,
    fees: Number(pick(p, ["fee", "collectedFee", "totalFees", "feesEarned"], 0)) || 0,
    apr: pick(p, ["apr", "currentApr"]) != null ? Number(pick(p, ["apr"])) : null,
    inRange: !!pick(p, ["inRange", "isInRange"], false),
    ageHour: Number(pick(p, ["ageHour", "age"], 0)) || 0,
    status: pick(p, ["status"], "Open"),
    raw: p,
  };
}

export function protocolLabel(p?: string) {
  if (!p) return "—";
  if (p.includes("damm_v2") || p.includes("dammv2")) return "DAMM v2";
  if (p.includes("dlmm")) return "DLMM";
  return p.replace("meteora_", "").toUpperCase();
}
