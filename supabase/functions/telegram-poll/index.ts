// Polls Telegram getUpdates and replies via the chat function (real LP Agent data).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/telegram";
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

async function tg(method: string, body: any) {
  const r = await fetch(`${GATEWAY}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      "X-Connection-Api-Key": Deno.env.get("TELEGRAM_API_KEY") ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`telegram ${method} ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

async function callChat(messages: any[], wallet: string | null) {
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
    body: JSON.stringify({ messages, wallet }),
  });
  return r.json();
}

function fmtToolReply(content: string, tools: any[]): string {
  let out = content || "";
  for (const t of tools || []) {
    const r = t.result || {};
    if (r._ui === "portfolio") {
      const o = r.overview || {};
      const fee = o?.total_fee?.["7D"] ?? 0;
      const pnl = o?.total_pnl?.["7D"] ?? 0;
      const wr = (o?.win_rate?.["7D"] ?? 0) * 100;
      out += `\n\n📊 <b>Portfolio</b>\nOpen: ${(r.positions || []).length}\nFees 7D: $${Number(fee).toFixed(2)}\nPnL 7D: $${Number(pnl).toFixed(2)}\nWin rate: ${wr.toFixed(1)}%`;
      const top = (r.positions || []).slice(0, 5);
      if (top.length) {
        out += "\n\n<b>Top open:</b>";
        for (const p of top) {
          const pair = `${p.tokenName0 || "?"}/${p.tokenName1 || "?"}`;
          out += `\n• ${pair} — $${Number(p.currentValue || 0).toFixed(2)} ${p.inRange ? "🟢" : "🟡"}`;
        }
      }
    } else if (r._ui === "pools") {
      const list = Array.isArray(r.pools) ? r.pools : (r.pools?.data || []);
      out += `\n\n🌊 <b>Pools</b>`;
      for (const p of list.slice(0, 6)) {
        const tvl = Number(p.tvl || 0);
        const vol = Number(p.vol_24h || 0);
        out += `\n• <b>${p.token0_symbol}/${p.token1_symbol}</b> · TVL $${(tvl / 1000).toFixed(1)}k · Vol24h $${(vol / 1000).toFixed(1)}k`;
      }
    }
  }
  return out.slice(0, 4000) || "✅";
}

async function handleUpdate(supabase: any, update: any) {
  const msg = update.message;
  if (!msg?.text) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // Commands
  if (text.startsWith("/start")) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: "👋 <b>LP Copilot</b>\nI'm your Solana LP assistant powered by LP Agent.\n\nCommands:\n• <code>/wallet &lt;address&gt;</code> — link a wallet\n• <code>/portfolio</code> — show your portfolio\n• <code>/pools</code> — top pools by 24h volume\n• Or just chat naturally!",
      parse_mode: "HTML",
    });
    return;
  }
  if (text.startsWith("/wallet")) {
    const addr = text.split(/\s+/)[1];
    if (!addr || addr.length < 32) {
      await tg("sendMessage", { chat_id: chatId, text: "Usage: <code>/wallet &lt;solana_address&gt;</code>", parse_mode: "HTML" });
      return;
    }
    await supabase.from("telegram_chat_wallets").upsert({ chat_id: chatId, wallet: addr, updated_at: new Date().toISOString() });
    await tg("sendMessage", { chat_id: chatId, text: `✅ Linked wallet <code>${addr.slice(0, 6)}…${addr.slice(-6)}</code>`, parse_mode: "HTML" });
    return;
  }

  // Get linked wallet
  const { data: link } = await supabase.from("telegram_chat_wallets").select("wallet").eq("chat_id", chatId).maybeSingle();
  const wallet = link?.wallet ?? null;

  let prompt = text;
  if (text.startsWith("/portfolio")) prompt = "Show my portfolio";
  else if (text.startsWith("/pools")) prompt = "Show top pools by 24h volume";

  await tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});

  const res = await callChat([{ role: "user", content: prompt }], wallet);
  if (res.error) {
    await tg("sendMessage", { chat_id: chatId, text: `⚠️ ${String(res.error).slice(0, 300)}` });
    return;
  }
  const reply = fmtToolReply(res.content || "", res.toolResults || []);
  await tg("sendMessage", { chat_id: chatId, text: reply || "✅", parse_mode: "HTML", disable_web_page_preview: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const start = Date.now();
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let processed = 0;

  const { data: state } = await supabase.from("telegram_bot_state").select("update_offset").eq("id", 1).single();
  let offset = state?.update_offset ?? 0;

  while (true) {
    const remaining = MAX_RUNTIME_MS - (Date.now() - start);
    if (remaining < MIN_REMAINING_MS) break;
    const timeout = Math.min(50, Math.floor(remaining / 1000) - 5);
    if (timeout < 1) break;

    let updates: any[] = [];
    try {
      const r = await tg("getUpdates", { offset, timeout, allowed_updates: ["message"] });
      updates = r.result || [];
    } catch (e) {
      console.error("getUpdates failed:", e);
      break;
    }
    if (updates.length === 0) continue;

    const rows = updates.filter((u: any) => u.message).map((u: any) => ({
      update_id: u.update_id, chat_id: u.message.chat.id, text: u.message.text ?? null, raw_update: u,
    }));
    if (rows.length) await supabase.from("telegram_messages").upsert(rows, { onConflict: "update_id" });

    for (const u of updates) {
      try { await handleUpdate(supabase, u); processed++; } catch (e) { console.error("handleUpdate error:", e); }
    }
    offset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await supabase.from("telegram_bot_state").update({ update_offset: offset, updated_at: new Date().toISOString() }).eq("id", 1);
  }

  return new Response(JSON.stringify({ ok: true, processed, offset }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
