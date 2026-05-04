import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useWallet } from "@/wallet/WalletProvider";
import { lp, fmtUsd, fmtPct, pick, shortAddr } from "@/lib/lpAgent";
import { Stat } from "@/components/Stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, ExternalLink, Sparkles, RefreshCw } from "lucide-react";
import { ZapDrawer, ZapIntent } from "@/components/ZapDrawer";
import { toast } from "@/hooks/use-toast";

export default function Portfolio() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { address: myAddr, connected, connect } = useWallet();
  const queryWallet = params.get("wallet");
  const wallet = queryWallet || myAddr;

  const [overview, setOverview] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [intent, setIntent] = useState<ZapIntent | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!wallet) { setOverview(null); setPositions([]); return; }
    let cancel = false;
    setLoading(true);
    Promise.allSettled([
      lp("portfolioOverview", { owner: wallet }),
      lp("openPositions", { owner: wallet }),
      lp("revenue", { owner: wallet, range: "7D" }),
    ]).then((res) => {
      if (cancel) return;
      const [o, p, r] = res;
      setOverview(o.status === "fulfilled" ? o.value : null);
      const posRaw = p.status === "fulfilled" ? p.value : null;
      const posList = Array.isArray(posRaw) ? posRaw : (posRaw?.positions || posRaw?.data || []);
      setPositions(Array.isArray(posList) ? posList : []);
      setRevenue(r.status === "fulfilled" ? r.value : null);
      if (o.status === "rejected") console.warn("overview", o.reason);
      if (p.status === "rejected") toast({ title: "Couldn't load positions", description: String(p.reason).slice(0, 160), variant: "destructive" });
    }).finally(() => !cancel && setLoading(false));
    return () => { cancel = true; };
  }, [wallet, refreshKey]);

  const kpis = useMemo(() => {
    const o = overview || {};
    return {
      totalValue: pick(o, ["totalValue", "totalValueUsd", "tvl", "totalLpValue"], 0),
      pnl24h: pick(o, ["pnl24h", "pnl24hUsd", "pnl_24h"], null),
      pnlTotal: pick(o, ["pnl", "pnlUsd", "totalPnl"], null),
      fees: pick(o, ["totalFees", "feesEarned", "totalFeesUsd"], null),
      avgApr: pick(o, ["avgApr", "apr", "averageApr"], null),
      inRange: pick(o, ["inRangePercent", "inRange", "in_range_percent"], null),
      open: pick(o, ["openPositions", "totalOpen"], positions?.length ?? 0),
    };
  }, [overview, positions]);

  if (!wallet) {
    return (
      <div className="p-8">
        <ConnectPrompt onConnect={connect} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Wallet</div>
          <div className="flex items-center gap-2 mt-0.5">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-sm">{shortAddr(wallet, 6)}</span>
            {queryWallet && (
              <Badge variant="outline" className="text-xs">read-only</Badge>
            )}
            <a href={`https://solscan.io/account/${wallet}`} target="_blank" rel="noreferrer"
               className="text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /></a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => navigate("/chat")}>
            <Sparkles className="h-3.5 w-3.5" /> Ask Copilot
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {loading && !overview ? (
          <>{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[88px]" />)}</>
        ) : (
          <>
            <Stat label="Total LP Value" value={fmtUsd(kpis.totalValue)}
              delta={kpis.pnl24h != null ? { value: Number(kpis.pnl24h), suffix: kpis.pnl24h > 1 || kpis.pnl24h < -1 ? "$" : "%" } : null} />
            <Stat label="Total PnL" value={kpis.pnlTotal != null ? fmtUsd(kpis.pnlTotal) : "—"} hint="all-time" />
            <Stat label="Fees Earned" value={kpis.fees != null ? fmtUsd(kpis.fees) : "—"} />
            <Stat label="Avg APR" value={kpis.avgApr != null ? fmtPct(kpis.avgApr) : "—"} />
            <Stat label="In Range" value={kpis.inRange != null ? fmtPct(kpis.inRange, 0) : "—"}
                  hint={`${kpis.open} open`} />
          </>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="font-semibold">Open Positions</div>
          <div className="text-xs text-muted-foreground">{positions.length} position{positions.length === 1 ? "" : "s"}</div>
        </div>
        {loading && positions.length === 0 ? (
          <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : positions.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No open Meteora LP positions found for this wallet.
            <div className="mt-3"><Button size="sm" onClick={() => navigate("/pools")}>Discover pools</Button></div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pair</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Fees</TableHead>
                <TableHead className="text-right">PnL</TableHead>
                <TableHead>Range</TableHead>
                <TableHead className="text-right">APR</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((p, i) => {
                const pair = pick(p, ["pair", "name"]) || `${pick(p, ["token0.symbol", "tokenX.symbol"], "?")}/${pick(p, ["token1.symbol", "tokenY.symbol"], "?")}`;
                const value = pick(p, ["currentValue", "valueUsd", "value", "totalValue"]);
                const fees = pick(p, ["feesEarned", "totalFees", "feesUsd"]);
                const pnl = pick(p, ["pnl", "pnlUsd"]);
                const inRange = pick(p, ["inRange", "isInRange"]);
                const apr = pick(p, ["apr", "currentApr"]);
                return (
                  <TableRow key={pick(p, ["id", "positionId"], i)}>
                    <TableCell className="font-medium">{pair}</TableCell>
                    <TableCell className="text-right num">{fmtUsd(value)}</TableCell>
                    <TableCell className="text-right num text-positive">{fees != null ? fmtUsd(fees) : "—"}</TableCell>
                    <TableCell className={`text-right num ${pnl > 0 ? "text-positive" : pnl < 0 ? "text-negative" : ""}`}>
                      {pnl != null ? fmtUsd(pnl) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={inRange ? "default" : "secondary"} className={inRange ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning border-warning/30"}>
                        {inRange ? "In range" : "Out of range"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right num">{apr != null ? fmtPct(apr) : "—"}</TableCell>
                    <TableCell className="text-right">
                      {!queryWallet && (
                        <Button size="sm" variant="outline" onClick={() => setIntent({ kind: "out", position: p })}>
                          Zap Out
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <ZapDrawer intent={intent} onClose={() => setIntent(null)} />
    </div>
  );
}

function ConnectPrompt({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-card to-secondary/40 p-10 text-center max-w-2xl mx-auto mt-12">
      <div className="h-12 w-12 mx-auto rounded-xl bg-primary/15 flex items-center justify-center mb-4">
        <Wallet className="h-6 w-6 text-primary" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Connect to view your LP portfolio</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Connect your Phantom wallet to see open Meteora positions, fees earned, PnL and in-range status — powered by LP Agent.
      </p>
      <Button onClick={onConnect} size="lg" className="bg-primary text-primary-foreground">
        <Wallet className="h-4 w-4" /> Connect Phantom
      </Button>
      <p className="text-xs text-muted-foreground mt-4">
        Or paste any wallet address in the search bar above to inspect read-only.
      </p>
    </div>
  );
}
