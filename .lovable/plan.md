
# LP Agent AI Copilot — Build Plan

A real, working Solana LP management copilot powered by LP Agent APIs. Web app first (Phantom signing), Telegram bot as a thin second surface in Day 3. **No dummy data** — every number on screen comes from LP Agent endpoints; AI never invents figures, it only narrates real tool results.

## Visual direction (inspired by Birdeye + Nansen)

- **Dark, data-dense, fintech feel.** Near-black bg (`#0B0E13`), elevated cards (`#141821`), subtle gridlines, mono numerics, green/red deltas, small sparkline charts.
- **Top bar (sticky):** logo • search (paste wallet or pool address, like Birdeye) • network badge (Solana) • **Connect Wallet** button on the far right (Phantom).
- **Left rail (icon nav):** Portfolio · Pools · Chat · Settings. Collapsible.
- **Main grid:** big KPI strip at top (Total Value, 24h PnL, Realized PnL, Fees Earned, In-range %), then content tabs.
- **Cards** look like Nansen/Birdeye: tight padding, label-on-top + big number + small delta chip, hoverable rows with right-aligned numerics.

## Pages (only what we need)

### 1. Landing / Connect (`/`)
Hero: "Talk to your Solana LP positions." Connect Phantom button. After connect → redirect to `/portfolio`.

### 2. Portfolio (`/portfolio`)
Top KPI strip (real LP Agent data for connected wallet):
- Total LP Value (USD) · 24h PnL · Total Fees Earned · Avg APR · In-Range %

Tabs:
- **Positions** — table: Pair · Pool · Value · Fees Earned · PnL · In-range badge · Age · row action menu (Zap out · Rebalance · View on Meteora).
- **History** — closed positions / past zaps.
- **Performance** — small line chart of portfolio value over time.

Wallet search: paste any wallet address (like Birdeye's wallet analyzer) to inspect read-only.

### 3. Discover Pools (`/pools`)
Filter bar (TVL, 24h volume, APR, fee tier, token search). Sortable table with row action **"⚡ Zap In"** → opens Zap drawer.

### 4. Zap Drawer (right-side `Sheet`, opens from anywhere)
- Pool summary, choose strategy (Spot / Curve / Bid-Ask), input SOL/USDC amount, slippage, expected position preview (from LP Agent quote endpoint), price impact, fees.
- "Sign & Execute" → LP Agent returns unsigned tx → Phantom signs → submit → toast with Solscan link.
- Same drawer handles Zap Out for a position.

### 5. AI Chat (`/chat`, also a floating panel everywhere)
Full-height chat. User types naturally; backend routes to Lovable AI Gateway with **tool calling**. Tools (each = a real LP Agent endpoint via our `lp-proxy`):
- `get_portfolio(wallet)`
- `get_position(positionId)`
- `list_pools(filters)`
- `get_pool(poolAddress)`
- `quote_zap_in(pool, amountSol, strategy)`
- `quote_zap_out(positionId, percent)`
- `prepare_zap_tx(...)` → returns unsigned tx for Phantom

Tool results render as **structured cards** in the chat (not just text): position cards, pool list, zap preview with the same "Sign & Execute" button. Markdown rendering for AI prose.

Examples that must work in the demo:
- "Show me my portfolio."
- "Find a SOL/USDC pool with ~30% APR, medium risk."
- "Zap 1 SOL into the top SOL/USDC pool with a balanced strategy."
- "Close half of my SOL/JUP position."

## Architecture

```text
React + Tailwind + shadcn (dark)
   │  Phantom (Solana Wallet Adapter)
   ▼
Lovable Cloud (Supabase) Edge Functions
   ├── lp-proxy        ──► api.lpagent.io   (uses LPAGENT_API_KEY secret)
   ├── chat            ──► ai.gateway.lovable.dev (tool calling → calls lp-proxy)
   └── telegram-poll   ──► Telegram Bot API (Day 3)
DB: chat_sessions, chat_messages, telegram_messages, telegram_bot_state
```

- Frontend never sees the LP Agent key.
- Zap execution: edge function returns base64 tx → frontend `VersionedTransaction.deserialize` → `wallet.signTransaction` → `connection.sendRawTransaction` → confirm.
- Telegram (Day 3) reuses the same `chat` function. Zap actions reply with a deep link `/zap?intent=...` because wallet signing inside Telegram is unreliable.

## Day-by-day

**Day 1 — Foundation + Portfolio (real data)**
- Enable Lovable Cloud, add `LPAGENT_API_KEY` secret.
- Build `lp-proxy` edge function (portfolio, pools, pool detail, zap quote, zap tx).
- Dark Birdeye/Nansen-style shell: top bar with Connect Wallet, left icon nav, KPI strip, positions table.
- Phantom connect + read real portfolio for the connected wallet.
- Wallet search (read-only inspect any address).

**Day 2 — Discover + Zap + AI**
- Pools page with filters/sort, real LP Agent data.
- Zap drawer with quote → sign → execute (real tx on mainnet).
- AI chat: `chat` edge function with Lovable AI tool-calling; render tool outputs as cards. Streaming tokens.

**Day 3 — Telegram + polish + demo**
- Telegram connector → `telegram-poll` edge function + pg_cron schedule.
- Bot: `/start`, `/portfolio <addr>`, `/pools`, free-text → same chat backend. Zap → deep link.
- Polish: empty states, loading skeletons, toasts, Solscan links, README with endpoints used + demo Loom.

## Scope cuts (intentionally out of v1)
- Copy-trading top LPers (mention as "next").
- Auto-rebalance scheduler.
- In-Telegram wallet signing (deep link instead).

## Risks & mitigations
- **Unknown LP Agent response shapes** → I'll fetch `https://docs.lpagent.io/llms.txt` first thing on Day 1 and shape `lp-proxy` to the real schemas.
- **Zap tx fails on demo** → test with a tiny amount Day 2 morning; keep read-only flows working independently so the demo never has a blank screen.
- **AI hallucination** → AI is forbidden (system prompt) from stating numbers not present in tool outputs.
- **Rate limits** → 30s in-memory cache in `lp-proxy`.

## What I need from you
1. Approve this plan.
2. Your **LP Agent API key** — I'll request it via the secrets prompt right after you approve.
3. (Day 3) BotFather token for Telegram — you'll create the bot, paste token into the Telegram connector when prompted.

That's it. After approval I switch to build mode and start with the dark shell + Phantom connect + real portfolio data.
