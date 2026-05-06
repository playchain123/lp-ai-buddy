import { useEffect, useMemo, useState } from "react";
import { Trade, gtTrades } from "@/lib/gecko";
import { fmtUsd, shortAddr } from "@/lib/lpAgent";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";

export function TradesFeed({ pool }: { pool: string }) {
  const [trades, setTrades] = useState<Trade[] | null>(null);

  useEffect(() => {
    let cancel = false;
    const load = () => gtTrades(pool, 0).then((t) => !cancel && setTrades(t));
    load();
    const id = setInterval(load, 15_000);
    return () => { cancel = true; clearInterval(id); };
  }, [pool]);

  const summary = useMemo(() => {
    if (!trades?.length) return null;
    const buys = trades.filter((t) => t.kind === "buy");
    const sells = trades.filter((t) => t.kind === "sell");
    const buyVol = buys.reduce((a, t) => a + t.volumeUsd, 0);
    const sellVol = sells.reduce((a, t) => a + t.volumeUsd, 0);
    const total = buyVol + sellVol || 1;
    return { buys: buys.length, sells: sells.length, buyVol, sellVol, buyPct: (buyVol / total) * 100 };
  }, [trades]);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-sm">Live Trades · Buy vs Sell Pressure</div>
          <span className="text-[10px] text-muted-foreground">Auto-refresh 15s · GeckoTerminal</span>
        </div>
        {summary && (
          <>
            <div className="h-2 w-full rounded-full overflow-hidden bg-secondary flex">
              <div className="bg-[hsl(var(--success))] h-full" style={{ width: `${summary.buyPct}%` }} />
              <div className="bg-[hsl(var(--destructive))] h-full" style={{ width: `${100 - summary.buyPct}%` }} />
            </div>
            <div className="flex justify-between text-[11px] mt-1.5 num">
              <span className="text-[hsl(var(--success))]">▲ Buys {summary.buys} · {fmtUsd(summary.buyVol, { compact: true })}</span>
              <span className="text-[hsl(var(--destructive))]">▼ Sells {summary.sells} · {fmtUsd(summary.sellVol, { compact: true })}</span>
            </div>
          </>
        )}
      </div>
      <div className="max-h-80 overflow-auto">
        {!trades ? (
          <div className="p-3 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : trades.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">No recent trades.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr><th className="text-left p-2">Time</th><th className="text-left">Side</th><th className="text-right">USD</th><th className="text-left pl-3">Wallet</th><th></th></tr>
            </thead>
            <tbody>
              {trades.slice(0, 60).map((t) => {
                const buy = t.kind === "buy";
                return (
                  <tr key={t.id} className="border-t border-border/60 hover:bg-secondary/40">
                    <td className="p-2 num text-muted-foreground">{new Date(t.ts).toLocaleTimeString()}</td>
                    <td className={buy ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}>{buy ? "BUY" : "SELL"}</td>
                    <td className={`text-right num ${buy ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}`}>{fmtUsd(t.volumeUsd, { compact: true })}</td>
                    <td className="pl-3 font-mono">
                      <a href={`https://solscan.io/account/${t.wallet}`} target="_blank" rel="noreferrer" className="hover:text-foreground">{shortAddr(t.wallet, 4)}</a>
                    </td>
                    <td className="pr-2">
                      <a href={`https://solscan.io/tx/${t.tx}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink className="h-3 w-3" /></a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
