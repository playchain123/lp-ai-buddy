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

// Format helpers
export const fmtUsd = (n: number | string | null | undefined, opts?: { compact?: boolean }) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || isNaN(v as number)) return "—";
  const num = v as number;
  if (opts?.compact && Math.abs(num) >= 1000) {
    if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  }
  return num.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
};

export const fmtPct = (n: number | string | null | undefined, digits = 2) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || isNaN(v as number)) return "—";
  return `${(v as number).toFixed(digits)}%`;
};

export const shortAddr = (a?: string | null, n = 4) =>
  a ? `${a.slice(0, n)}…${a.slice(-n)}` : "";

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
