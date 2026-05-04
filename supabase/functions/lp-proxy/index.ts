// LP Agent API proxy - keeps API key server-side, exposes a single dispatch endpoint.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const API_BASE = "https://api.lpagent.io/open-api/v1";

interface ProxyReq {
  action: string;
  params?: Record<string, any>;
  body?: Record<string, any>;
}

// Simple in-memory cache (per-isolate). Short TTL to keep data fresh.
const cache = new Map<string, { at: number; data: any }>();
const CACHE_TTL = 20_000;

async function lpFetch(method: "GET" | "POST", path: string, apiKey: string, params?: Record<string, any>, body?: Record<string, any>) {
  const url = new URL(`${API_BASE}${path}`);
  if (method === "GET" && params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    });
  }
  const key = `${method}:${url.toString()}:${body ? JSON.stringify(body) : ""}`;
  if (method === "GET") {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data;
  }
  const res = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`LP Agent ${method} ${path} ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  if (method === "GET") cache.set(key, { at: Date.now(), data });
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("LPAGENT_API_KEY");
    if (!apiKey) throw new Error("LPAGENT_API_KEY not configured");
    const { action, params = {}, body }: ProxyReq = await req.json();

    let result: any;
    switch (action) {
      // --- Discovery ---
      case "discoverPools": {
        const { poolId, ...rest } = params;
        const p: any = { chain: "SOL", pageSize: 30, sortOrder: "desc", ...rest };
        result = await lpFetch("GET", "/pools/discover", apiKey, p);
        break;
      }
      case "poolInfo":
        result = await lpFetch("GET", `/pools/${params.poolId}/info`, apiKey);
        break;
      case "poolOnchainStats":
        result = await lpFetch("GET", `/pools/${params.poolId}/onchain-stats`, apiKey);
        break;
      case "poolPositions":
        result = await lpFetch("GET", `/pools/${params.poolId}/positions`, apiKey, { pageSize: 20, ...params });
        break;
      case "poolTopLpers":
        result = await lpFetch("GET", `/pools/${params.poolId}/top-lpers`, apiKey, { pageSize: 10, ...params });
        break;

      // --- Portfolio ---
      case "openPositions":
        result = await lpFetch("GET", "/lp-positions/opening", apiKey, params);
        break;
      case "historicalPositions":
        result = await lpFetch("GET", "/lp-positions/historical", apiKey, params);
        break;
      case "portfolioOverview":
        result = await lpFetch("GET", "/lp-positions/overview", apiKey, params);
        break;
      case "positionLogs":
        result = await lpFetch("GET", "/lp-positions/logs", apiKey, params);
        break;
      case "revenue":
        result = await lpFetch("GET", `/lp-positions/revenue/${params.owner}`, apiKey, { range: params.range || "7D" });
        break;
      case "tokenBalance":
        result = await lpFetch("GET", "/token/balance", apiKey, params);
        break;

      // --- Zap In ---
      case "zapInTx":
        // body: { stratergy, owner, fromBinId, toBinId, slippage, amount, mode: 'zap-in', ... }
        result = await lpFetch("POST", `/pools/${params.poolId}/add-tx`, apiKey, undefined, body);
        break;
      case "zapInLand":
        // body: { signedTxs: string[] }
        result = await lpFetch("POST", "/pools/landing-add-tx", apiKey, undefined, body);
        break;

      // --- Zap Out ---
      case "zapOutQuote":
        // body: { id, bps }
        result = await lpFetch("POST", "/position/decrease-quotes", apiKey, undefined, body);
        break;
      case "zapOutTx":
        // body: { position_id, bps, owner, slippage_bps, output }
        result = await lpFetch("POST", "/position/decrease-tx", apiKey, undefined, body);
        break;
      case "zapOutLand":
        result = await lpFetch("POST", "/position/landing-decrease-tx", apiKey, undefined, body);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ ok: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lp-proxy error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
