// Zap-in / zap-out helpers: build the unsigned tx (calls LP Agent), and land signed txs.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://api.lpagent.io/open-api/v1";

async function lp(method: string, path: string, apiKey: string, body?: any, qs?: any) {
  const url = new URL(`${API_BASE}${path}`);
  if (qs) Object.entries(qs).forEach(([k, v]) => v != null && url.searchParams.set(k, String(v)));
  const r = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let j: any; try { j = JSON.parse(text); } catch { j = { raw: text }; }
  if (!r.ok) throw new Error(`LP Agent ${method} ${path} ${r.status}: ${typeof j === "string" ? j : JSON.stringify(j)}`);
  return j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("LPAGENT_API_KEY");
    if (!apiKey) throw new Error("LPAGENT_API_KEY not configured");
    const { op, payload } = await req.json();
    let data: any;

    if (op === "zapInBuild") {
      // payload: { poolId, owner, amountSol, strategy, slippageBps, range? }
      const info = await lp("GET", `/pools/${payload.poolId}/info`, apiKey);
      const activeBinId = info?.activeBinId ?? info?.activeBin?.binId ?? info?.data?.activeBinId ?? 0;
      const span = payload.binSpan ?? 34; // ~standard range
      const fromBinId = payload.fromBinId ?? activeBinId - span;
      const toBinId = payload.toBinId ?? activeBinId + span;
      const lamports = Math.floor(payload.amountSol * 1e9);
      const body = {
        stratergy: payload.strategy || "Spot",
        owner: payload.owner,
        mode: "zap-in",
        slippage: payload.slippageBps ?? 100,
        amount: String(lamports),
        fromBinId,
        toBinId,
      };
      data = await lp("POST", `/pools/${payload.poolId}/add-tx`, apiKey, body);
      return new Response(JSON.stringify({ ok: true, data, meta: { activeBinId, fromBinId, toBinId } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (op === "zapInLand") {
      data = await lp("POST", "/pools/landing-add-tx", apiKey, payload);
      return new Response(JSON.stringify({ ok: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (op === "zapOutBuild") {
      // payload: { positionId, owner, bps, slippageBps, output }
      const body = {
        position_id: payload.positionId,
        owner: payload.owner,
        bps: payload.bps ?? 10000,
        slippage_bps: payload.slippageBps ?? 100,
        output: payload.output || "allBaseToken",
      };
      data = await lp("POST", "/position/decrease-tx", apiKey, body);
      return new Response(JSON.stringify({ ok: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (op === "zapOutLand") {
      data = await lp("POST", "/position/landing-decrease-tx", apiKey, payload);
      return new Response(JSON.stringify({ ok: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown op: ${op}`);
  } catch (e) {
    console.error("zap-execute error:", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
