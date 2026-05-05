// AI chat with tool calling -> LP Agent via lp-proxy.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are LP Copilot, an AI assistant for Solana liquidity providers using Meteora pools (DLMM and DAMM v2) via the LP Agent platform.

CRITICAL RULES:
- NEVER invent numbers, APRs, prices, or position data. ONLY state values that appear in tool results.
- When the user asks anything about their portfolio, positions, fees, or PnL — call get_portfolio first (you receive their connected wallet in the system context).
- When the user asks about pools, opportunities, or "where to LP" — call list_pools with appropriate filters.
- When the user wants to enter a position, propose a zap with quote_zap_in. Always show: pool pair, strategy, amount, expected price impact. Then ask the user to click "Sign & Execute" in the card.
- When the user wants to close/reduce a position, call quote_zap_out (bps = 10000 means 100%).
- Prefer brief, structured replies with markdown tables/bullets. Numbers in monospace.
- If a tool fails, say so plainly and suggest a next step.
- The UI renders structured cards from your tool results, so you don't need to repeat all data in prose — just summarize and recommend.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_portfolio",
      description: "Get the connected wallet's open LP positions and aggregated portfolio overview (total value, PnL, fees earned, in-range %).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_pools",
      description: "Discover Meteora pools with filters. Use to find LP opportunities.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Token symbol or pair (e.g. 'SOL/USDC' or 'JUP')." },
          minTvl: { type: "number", description: "Minimum TVL USD." },
          minVolume24h: { type: "number", description: "Minimum 24h volume USD." },
          minApr: { type: "number", description: "Minimum APR percent." },
          sortBy: { type: "string", enum: ["tvl", "vol_24h", "vol_1h", "fee"], description: "Sort key." },
          pageSize: { type: "number", description: "Default 10, max 30." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pool",
      description: "Get detailed info for one pool (active bin, token info, fees) by pool address.",
      parameters: { type: "object", properties: { poolId: { type: "string" } }, required: ["poolId"] },
    },
  },
  {
    type: "function",
    function: {
      name: "quote_zap_in",
      description: "Generate a zap-in transaction preview for entering a pool with SOL. Returns a card the user can sign.",
      parameters: {
        type: "object",
        properties: {
          poolId: { type: "string", description: "Pool address." },
          amountSol: { type: "number", description: "Amount of SOL to deposit." },
          strategy: { type: "string", enum: ["Spot", "Curve", "BidAsk"], description: "Distribution strategy. Spot = balanced." },
        },
        required: ["poolId", "amountSol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "quote_zap_out",
      description: "Quote how much the user would receive when closing part or all of a position. bps 10000 = 100%.",
      parameters: {
        type: "object",
        properties: {
          positionId: { type: "string" },
          bps: { type: "number", description: "Basis points to withdraw (10000 = 100%)." },
        },
        required: ["positionId"],
      },
    },
  },
];

async function callProxy(action: string, params?: any, body?: any) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/lp-proxy`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({ action, params, body }),
  });
  const j = await res.json();
  if (!res.ok || !j?.ok) throw new Error(j?.error || `LP proxy ${res.status}`);
  return j.data;
}

function unwrap(v: any) {
  if (v?.data?.data !== undefined) return v.data.data;
  if (v?.data !== undefined) return v.data;
  return v;
}

function firstRow(v: any) {
  const u = unwrap(v);
  return Array.isArray(u) ? (u[0] || {}) : (u || {});
}

function rows(v: any) {
  const u = unwrap(v);
  if (Array.isArray(u)) return u;
  if (Array.isArray(u?.positions)) return u.positions;
  if (Array.isArray(u?.pools)) return u.pools;
  if (Array.isArray(u?.data)) return u.data;
  return [];
}

async function executeTool(name: string, args: any, wallet: string | null) {
  try {
    switch (name) {
      case "get_portfolio": {
        if (!wallet) return { error: "No wallet connected. Ask the user to connect their Phantom wallet." };
        const [overview, positions, historical, revenue] = await Promise.all([
          callProxy("portfolioOverview", { owner: wallet }),
          callProxy("openPositions", { owner: wallet, pageSize: 50 }),
          callProxy("historicalPositions", { owner: wallet, pageSize: 20 }),
          callProxy("revenue", { owner: wallet, range: args.range || "7D" }),
        ]);
        const ovRow = firstRow(overview);
        const posList = rows(positions);
        const histList = rows(historical);
        return {
          overview: ovRow,
          positions: posList,
          historical: histList,
          revenue: unwrap(revenue),
          _ui: "portfolio",
          wallet,
        };
      }
      case "list_pools": {
        const p: any = { pageSize: args.pageSize || 10, sortOrder: "desc" };
        if (args.search) p.search = args.search;
        if (args.minTvl) p.minTvl = args.minTvl;
        if (args.minVolume24h) p.minVol24h = args.minVolume24h;
        if (args.sortBy) p.sortBy = args.sortBy;
        const r = await callProxy("discoverPools", p);
        return { pools: unwrap(r), _ui: "pools" };
      }
      case "get_pool": {
        const [info, stats, positions, lpers] = await Promise.all([
          callProxy("poolInfo", { poolId: args.poolId }),
          callProxy("poolOnchainStats", { poolId: args.poolId }),
          callProxy("poolPositions", { poolId: args.poolId, page: 1, pageSize: 20, status: "Open" }),
          callProxy("poolTopLpers", { poolId: args.poolId, page: 1, limit: 20 }),
        ]);
        return { pool: unwrap(info), stats: firstRow(stats?.data?.poolStats ? stats.data.poolStats : stats), positions: rows(positions), lpers: rows(lpers), _ui: "pool" };
      }
      case "quote_zap_in": {
        const info = await callProxy("poolInfo", { poolId: args.poolId });
        return {
          intent: "zap_in",
          poolId: args.poolId,
          amountSol: args.amountSol,
          strategy: args.strategy || "Spot",
          poolInfo: unwrap(info),
          _ui: "zap_in_card",
        };
      }
      case "quote_zap_out": {
        const bps = args.bps || 10000;
        const r = await callProxy("zapOutQuote", undefined, { id: args.positionId, bps });
        return { intent: "zap_out", positionId: args.positionId, bps, quote: unwrap(r), _ui: "zap_out_card" };
      }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  return { error: "unknown_tool" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { messages, wallet } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const sysCtx = wallet
      ? `${SYSTEM_PROMPT}\n\nConnected wallet: ${wallet}`
      : `${SYSTEM_PROMPT}\n\nNo wallet connected.`;

    const convo: any[] = [{ role: "system", content: sysCtx }, ...messages];
    const toolResultsForUI: any[] = [];

    // Tool-calling loop (max 4 hops to keep latency bounded).
    for (let hop = 0; hop < 4; hop++) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: convo,
          tools: TOOLS,
          tool_choice: "auto",
          max_tokens: 2048,
        }),
      });
      if (!aiRes.ok) {
        const t = await aiRes.text();
        if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Top up in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway ${aiRes.status}: ${t}`);
      }
      const j = await aiRes.json();
      const msg = j.choices?.[0]?.message;
      if (!msg) throw new Error("No AI message");
      convo.push(msg);

      const calls = msg.tool_calls;
      if (!calls || calls.length === 0) {
        return new Response(JSON.stringify({ content: msg.content || fallbackSummary(toolResultsForUI), toolResults: toolResultsForUI }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      for (const c of calls) {
        let args: any = {};
        try { args = JSON.parse(c.function.arguments || "{}"); } catch {}
        const result = await executeTool(c.function.name, args, wallet);
        toolResultsForUI.push({ name: c.function.name, args, result });
        convo.push({
          role: "tool",
          tool_call_id: c.id,
          content: JSON.stringify(result).slice(0, 12000),
        });
      }
    }
    return new Response(JSON.stringify({ content: fallbackSummary(toolResultsForUI) || "I tried multiple steps but couldn't finish. Please rephrase.", toolResults: toolResultsForUI }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function fallbackSummary(toolResults: any[]) {
  const last = toolResults.at(-1)?.result;
  if (!last) return "";
  if (last.error) return `LP Agent returned an error: ${last.error}`;
  if (last._ui === "pools") return `I found ${Array.isArray(last.pools) ? last.pools.length : 0} live pools from LP Agent. Open a pool card to inspect details or start a Zap.`;
  if (last._ui === "portfolio") return `I loaded the wallet portfolio from LP Agent: ${(last.positions || []).length} open positions found.`;
  if (last._ui === "pool") return `I loaded live pool details, on-chain stats, open positions and LPers from LP Agent.`;
  if (last._ui?.includes("zap")) return `I prepared the Zap quote. Review it and confirm before signing.`;
  return "I loaded live LP Agent data for your request.";
}
