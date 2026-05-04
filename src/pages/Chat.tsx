import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useWallet } from "@/wallet/WalletProvider";
import { chatFn, fmtUsd, fmtPct, pick, shortAddr } from "@/lib/lpAgent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Zap, Loader2, Wallet } from "lucide-react";
import { ZapDrawer, ZapIntent } from "@/components/ZapDrawer";

type Msg = { role: "user" | "assistant"; content: string; tools?: any[] };

const SUGGESTIONS = [
  "Show my LP portfolio",
  "Find SOL/USDC pools with the highest 24h volume",
  "Best APR pools above $100k TVL",
  "What pools should I LP into right now?",
];

export default function Chat() {
  const { connected, address, connect } = useWallet();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hey 👋 I'm your LP Copilot. Connect your wallet, then ask me anything about your Meteora positions or pool opportunities." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<ZapIntent | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await chatFn(next.map(({ role, content }) => ({ role, content })), address);
      setMessages([...next, { role: "assistant", content: res.content || "", tools: res.toolResults || [] }]);
    } catch (e: any) {
      setMessages([...next, { role: "assistant", content: `⚠️ ${e?.message || "Something went wrong."}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="px-4 sm:px-6 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold leading-tight">LP Copilot</div>
            <div className="text-xs text-muted-foreground">Real LP Agent data · Tool-calling AI</div>
          </div>
        </div>
        {connected ? (
          <Badge variant="outline" className="font-mono text-xs"><span className="h-1.5 w-1.5 rounded-full bg-success mr-1.5" />{shortAddr(address, 4)}</Badge>
        ) : (
          <Button size="sm" onClick={connect}><Wallet className="h-3.5 w-3.5" /> Connect</Button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 max-w-4xl w-full mx-auto">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex"}>
            <div className={
              m.role === "user"
                ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%] text-sm"
                : "max-w-[92%] w-full"
            }>
              {m.role === "assistant" ? (
                <>
                  {(m.tools || []).map((t, j) => <ToolCard key={j} tool={t} onZap={setIntent} />)}
                  {m.content && (
                    <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed
                                    prose-p:my-2 prose-headings:mt-3 prose-headings:mb-1
                                    prose-strong:text-foreground prose-table:my-2 prose-th:text-muted-foreground
                                    prose-code:bg-secondary prose-code:px-1 prose-code:rounded">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  )}
                </>
              ) : m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking and calling LP Agent…
          </div>
        )}
        {messages.length <= 1 && !busy && (
          <div className="flex flex-wrap gap-2 pt-2">
            {SUGGESTIONS.map((s) => (
              <Button key={s} variant="outline" size="sm" className="h-8 text-xs" onClick={() => send(s)}>{s}</Button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-border p-3 sm:p-4 bg-card/40">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Input
            value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={connected ? "Ask anything — e.g. 'zap 0.5 SOL into the top SOL/USDC pool'" : "Connect wallet to ask about your positions…"}
            className="bg-background h-11"
            disabled={busy}
          />
          <Button type="submit" disabled={busy || !input.trim()} className="bg-primary text-primary-foreground h-11 px-4">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>

      <ZapDrawer intent={intent} onClose={() => setIntent(null)} />
    </div>
  );
}

function ToolCard({ tool, onZap }: { tool: any; onZap: (i: ZapIntent) => void }) {
  const r = tool.result || {};
  if (r.error) {
    return <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive mb-2">⚠️ {r.error}</div>;
  }
  if (r._ui === "portfolio") {
    const o = r.overview || {};
    return (
      <div className="rounded-lg border border-border bg-card p-3 mb-2">
        <div className="text-xs text-muted-foreground mb-2">Portfolio · {shortAddr(r.wallet, 4)}</div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Mini label="Value" value={fmtUsd(pick(o, ["totalValue", "totalValueUsd"], 0))} />
          <Mini label="Fees" value={fmtUsd(pick(o, ["totalFees", "feesEarned"], 0))} />
          <Mini label="In Range" value={fmtPct(pick(o, ["inRangePercent", "inRange"], 0), 0)} />
        </div>
        <div className="space-y-1.5 max-h-72 overflow-auto">
          {(r.positions || []).slice(0, 8).map((p: any, i: number) => {
            const pair = pick(p, ["pair"]) || `${pick(p, ["token0.symbol", "tokenX.symbol"], "?")}/${pick(p, ["token1.symbol", "tokenY.symbol"], "?")}`;
            return (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                <span className="font-medium">{pair}</span>
                <span className="num">{fmtUsd(pick(p, ["currentValue", "valueUsd"]))}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  if (r._ui === "pools") {
    const list = Array.isArray(r.pools) ? r.pools : (r.pools?.pools || r.pools?.data || []);
    return (
      <div className="rounded-lg border border-border bg-card p-3 mb-2">
        <div className="text-xs text-muted-foreground mb-2">Pools matching your query</div>
        <div className="space-y-1.5 max-h-80 overflow-auto">
          {list.slice(0, 8).map((p: any, i: number) => {
            const name = pick(p, ["pair", "name"]) || `${pick(p, ["token0.symbol", "tokenX.symbol"], "?")}/${pick(p, ["token1.symbol", "tokenY.symbol"], "?")}`;
            return (
              <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    TVL {fmtUsd(pick(p, ["tvl", "tvlUsd"]), { compact: true })} ·
                    Vol {fmtUsd(pick(p, ["volume24h", "volume24hUsd"]), { compact: true })} ·
                    APR {fmtPct(pick(p, ["apr"], 0))}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-7" onClick={() => onZap({ kind: "in", pool: p })}>
                  <Zap className="h-3 w-3" /> Zap
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  if (r._ui === "zap_in_card") {
    return (
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 mb-2">
        <div className="flex items-center gap-2 text-sm mb-1"><Zap className="h-4 w-4 text-primary" /> Zap In ready</div>
        <div className="text-xs text-muted-foreground">{r.amountSol} SOL · strategy {r.strategy}</div>
        <Button size="sm" className="mt-2 bg-primary text-primary-foreground" onClick={() => onZap({ kind: "in", pool: { address: r.poolId, ...(r.poolInfo || {}) } })}>
          Open Zap drawer
        </Button>
      </div>
    );
  }
  return null;
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/60 p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold num">{value}</div>
    </div>
  );
}
