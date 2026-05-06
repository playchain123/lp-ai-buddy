import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { lp, fmtUsd, fmtPct, fmtNum, shortAddr, listRows, unwrap, protocolLabel } from "@/lib/lpAgent";
import { tokenIcon } from "@/lib/gecko";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/Stat";
import { PulseCell } from "@/components/PulseCell";
import { CandleChart } from "@/components/CandleChart";
import { TradesFeed } from "@/components/TradesFeed";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Zap, ExternalLink } from "lucide-react";
import { ZapDrawer, ZapIntent } from "@/components/ZapDrawer";

export default function PoolDetail() {
  const { id } = useParams<{ id: string }>();
  const [info, setInfo] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [topLpers, setTopLpers] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [discover, setDiscover] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [intent, setIntent] = useState<ZapIntent | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.allSettled([
      lp("poolInfo", { poolId: id }),
      lp("poolOnchainStats", { poolId: id }),
      lp("poolTopLpers", { poolId: id, page: 1, limit: 50, sort_order: "desc" }),
      lp("poolPositions", { poolId: id, page: 1, pageSize: 20, status: "Open" }),
      lp("discoverPools", { search: id, pageSize: 1 }),
    ]).then(([i, s, t, p, d]) => {
      setInfo(i.status === "fulfilled" ? unwrap(i.value) : null);
      const sd = s.status === "fulfilled" ? unwrap(s.value) : null;
      setStats(sd?.poolStats?.[0] ?? sd);
      setTopLpers(t.status === "fulfilled" ? listRows(t.value) : []);
      setPositions(p.status === "fulfilled" ? listRows(p.value) : []);
      setDiscover(d.status === "fulfilled" ? listRows(d.value)[0] : null);
    }).finally(() => setLoading(false));
  }, [id]);

  const t0info = info?.tokenInfo?.[0]?.data?.[0];
  const t1info = info?.tokenInfo?.[1]?.data?.[0];
  const sym0 = t0info?.symbol || discover?.token0_symbol || "?";
  const sym1 = t1info?.symbol || discover?.token1_symbol || "?";
  const mint0 = discover?.token0;
  const mint1 = discover?.token1;
  const proto = info?.type || discover?.protocol;

  // Prefer the non-stable / non-SOL token for the price chart context
  const price = discover?.usd_price ?? t1info?.usdPrice ?? t0info?.usdPrice;
  const mcap = discover?.mcap ?? t1info?.mcap ?? t0info?.mcap;
  const liquidity = discover?.tvl ?? info?.poolDb?.tvl ?? stats?.total_input_value;

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link to="/pools" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          {loading && !discover ? <Skeleton className="h-7 w-48" /> : (
            <div className="flex items-center gap-2">
              <span className="flex items-center">
                <img src={t0info?.icon || tokenIcon(mint0)} alt="" className="h-7 w-7 rounded-full bg-secondary" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                <img src={t1info?.icon || tokenIcon(mint1)} alt="" className="h-7 w-7 rounded-full bg-secondary -ml-3" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
              </span>
              <h1 className="text-2xl font-semibold">{sym0} / {sym1}</h1>
              <Badge variant="outline" className="text-xs">{protocolLabel(proto)}</Badge>
            </div>
          )}
          <div className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-2">
            {shortAddr(id, 6)}
            <a href={`https://app.meteora.ag/pools/${id}`} target="_blank" rel="noreferrer" className="hover:text-foreground"><ExternalLink className="h-3 w-3" /></a>
            <a href={`https://www.geckoterminal.com/solana/pools/${id}`} target="_blank" rel="noreferrer" className="hover:text-foreground">GeckoTerminal</a>
          </div>
        </div>
        <Button className="bg-primary text-primary-foreground" onClick={() => setIntent({ kind: "in", pool: { pool: id, token0_symbol: sym0, token1_symbol: sym1, ...discover, ...info } })}>
          <Zap className="h-4 w-4" /> Zap In
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <Stat label="Price" value={price != null ? fmtUsd(price, { digits: price < 1 ? 6 : 2 }) : "—"} />
        <Stat label="Market Cap" value={mcap != null ? fmtUsd(mcap, { compact: true }) : "—"} />
        <Stat label="Liquidity / TVL" value={fmtUsd(liquidity, { compact: true })} />
        <Stat label="Vol 24h" value={fmtUsd(discover?.vol_24h, { compact: true })} />
        <Stat label="Open Positions" value={fmtNum(stats?.total_open_positions ?? positions.length, 0)} />
        <Stat label="Unique LPers" value={fmtNum(stats?.unique_owners ?? topLpers.length, 0)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-xs">
        <div className="rounded border border-border bg-card p-3"><div className="text-muted-foreground">5m</div><PulseCell value={Number(discover?.price_5m_change || 0)} /></div>
        <div className="rounded border border-border bg-card p-3"><div className="text-muted-foreground">1h</div><PulseCell value={Number(discover?.price_1h_change || 0)} /></div>
        <div className="rounded border border-border bg-card p-3"><div className="text-muted-foreground">6h</div><PulseCell value={Number(discover?.price_6h_change || 0)} /></div>
        <div className="rounded border border-border bg-card p-3"><div className="text-muted-foreground">24h</div><PulseCell value={Number(discover?.price_24h_change || 0)} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        <div className="lg:col-span-2"><CandleChart pool={id!} quoteSymbol={sym1} /></div>
        <TradesFeed pool={id!} />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-semibold flex items-center justify-between">
          <span>Top LPers · {topLpers.length}</span>
          <span className="text-xs text-muted-foreground font-normal">Ranked by ROI</span>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : topLpers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No LP data yet for this pool.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead><TableHead>Wallet</TableHead>
                <TableHead className="text-right">Inflow</TableHead>
                <TableHead className="text-right">Fees</TableHead>
                <TableHead className="text-right">PnL</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Positions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topLpers.map((l, i) => (
                <TableRow key={l.owner}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>
                    <Link to={`/portfolio?wallet=${l.owner}`} className="font-mono text-sm hover:text-primary">{shortAddr(l.owner, 6)}</Link>
                  </TableCell>
                  <TableCell className="text-right num">{fmtUsd(l.total_inflow, { compact: true })}</TableCell>
                  <TableCell className="text-right num text-[hsl(var(--success))]">{fmtUsd(l.total_fee, { compact: true })}</TableCell>
                  <TableCell className={`text-right num ${l.total_pnl > 0 ? "text-[hsl(var(--success))]" : l.total_pnl < 0 ? "text-[hsl(var(--destructive))]" : ""}`}>{fmtUsd(l.total_pnl, { compact: true })}</TableCell>
                  <TableCell className={`text-right num ${l.roi > 0 ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}`}>{fmtPct((l.roi ?? 0) * 100)}</TableCell>
                  <TableCell className="text-right num">{fmtPct((l.win_rate ?? 0) * 100, 0)}</TableCell>
                  <TableCell className="text-right num">{l.total_lp ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ZapDrawer intent={intent} onClose={() => setIntent(null)} />
    </div>
  );
}
