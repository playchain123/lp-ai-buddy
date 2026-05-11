import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { lp, fmtUsd, fmtPct, fmtNum, shortAddr, listRows, unwrap, protocolLabel, poolMetric } from "@/lib/lpAgent";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/Stat";
import { PulseCell } from "@/components/PulseCell";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { TokenIcon } from "@/components/TokenIcon";
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

  const metricSources = [discover, info?.poolDb, info, stats, t0info, t1info].filter(Boolean);
  const tokenInfoSources = [t0info, t1info].filter(Boolean);
  const price = poolMetric(metricSources, ["usd_price", "price", "priceUsd", "usdPrice", "token_price", "tokenPrice"])
    ?? poolMetric(tokenInfoSources, ["usdPrice", "priceUsd", "price", "currentPrice"]);
  const mcap = poolMetric(metricSources, ["mcap", "market_cap", "marketCap", "fdv", "fully_diluted_valuation"])
    ?? poolMetric(tokenInfoSources, ["mcap", "marketCap", "market_cap", "fdv"]);
  const liquidity = poolMetric(metricSources, ["tvl", "liquidity", "liquidityUsd", "reserve_in_usd", "totalLiquidityUsd", "pool_tvl", "total_input_value"], 0);
  const volume24h = poolMetric(metricSources, ["vol_24h", "volume24h", "volume_24h", "volumeUsd24h", "volumeUsd", "trade_volume_24h"], 0);
  const openPositions = poolMetric(metricSources, ["total_open_positions", "open_positions", "openPositions"], positions.length) ?? positions.length;
  const uniqueLpers = poolMetric(metricSources, ["unique_owners", "unique_lpers", "uniqueLPers", "total_unique_owners", "total_owners"], topLpers.length) ?? topLpers.length;

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link to="/pools" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          {loading && !discover ? <Skeleton className="h-7 w-48" /> : (
            <div className="flex items-center gap-2">
              <span className="flex items-center">
                <TokenIcon mint={mint0} symbol={sym0} size={28} />
                <TokenIcon mint={mint1} symbol={sym1} size={28} className="-ml-3" />
              </span>
              <h1 className="text-2xl font-semibold">{sym0} / {sym1}</h1>
              <Badge variant="outline" className="text-xs">{protocolLabel(proto)}</Badge>
            </div>
          )}
          <div className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-2">
            {shortAddr(id, 6)}
            <a href={`https://app.meteora.ag/pools/${id}`} target="_blank" rel="noreferrer" className="hover:text-foreground"><ExternalLink className="h-3 w-3" /></a>
            <a href={`https://solscan.io/account/${id}`} target="_blank" rel="noreferrer" className="hover:text-foreground">Solscan</a>
          </div>
        </div>
        <Button className="bg-primary text-primary-foreground" onClick={() => setIntent({ kind: "in", pool: { pool: id, token0_symbol: sym0, token1_symbol: sym1, ...discover, ...info } })}>
          <Zap className="h-4 w-4" /> Zap In
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <Stat label="Price" value={price != null ? <AnimatedNumber value={Number(price)} format={(n) => fmtUsd(n, { digits: n < 1 ? 6 : 2 })} /> : "—"} />
        <Stat label="Market Cap" value={mcap != null ? <AnimatedNumber value={Number(mcap)} format={(n) => fmtUsd(n, { compact: true })} /> : "—"} />
        <Stat label="Liquidity / TVL" value={<AnimatedNumber value={Number(liquidity || 0)} format={(n) => fmtUsd(n, { compact: true })} />} />
        <Stat label="Vol 24h" value={<AnimatedNumber value={Number(volume24h || 0)} format={(n) => fmtUsd(n, { compact: true })} />} />
        <Stat label="Open Positions" value={fmtNum(openPositions, 0)} />
        <Stat label="Unique LPers" value={fmtNum(uniqueLpers, 0)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-xs">
        <div className="rounded border border-border bg-card p-3"><div className="text-muted-foreground">5m</div><PulseCell value={Number(discover?.price_5m_change || 0)} /></div>
        <div className="rounded border border-border bg-card p-3"><div className="text-muted-foreground">1h</div><PulseCell value={Number(discover?.price_1h_change || 0)} /></div>
        <div className="rounded border border-border bg-card p-3"><div className="text-muted-foreground">6h</div><PulseCell value={Number(discover?.price_6h_change || 0)} /></div>
        <div className="rounded border border-border bg-card p-3"><div className="text-muted-foreground">24h</div><PulseCell value={Number(discover?.price_24h_change || 0)} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-3 mb-6">
        <CandleChart pool={id!} quoteSymbol={sym1} pairLabel={`${sym0}/${sym1}`} />
        <TradesFeed pool={id!} />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-semibold flex items-center justify-between">
          <span>LP Leaderboard · {topLpers.length}</span>
          <span className="text-xs text-muted-foreground font-normal">Live ranking from LP Agent · sorted by ROI</span>
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
