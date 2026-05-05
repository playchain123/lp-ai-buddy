import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { lp, fmtUsd, fmtPct, fmtNum, pick, shortAddr, listRows, unwrap, protocolLabel } from "@/lib/lpAgent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/Stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Zap, ExternalLink, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { ZapDrawer, ZapIntent } from "@/components/ZapDrawer";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from "recharts";

export default function PoolDetail() {
  const { id } = useParams<{ id: string }>();
  const [info, setInfo] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [topLpers, setTopLpers] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [intent, setIntent] = useState<ZapIntent | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.allSettled([
      lp("poolInfo", { poolId: id }),
      lp("poolOnchainStats", { poolId: id }),
      lp("poolTopLpers", { poolId: id, page: 1, limit: 100 }),
      lp("poolPositions", { poolId: id, page: 1, pageSize: 20, status: "Open" }),
    ]).then(([i, s, t, p]) => {
      setInfo(i.status === "fulfilled" ? unwrap(i.value) : null);
      const sd = s.status === "fulfilled" ? unwrap(s.value) : null;
      setStats(sd?.poolStats?.[0] ?? sd);
      setTopLpers(t.status === "fulfilled" ? listRows(t.value) : []);
      setPositions(p.status === "fulfilled" ? listRows(p.value) : []);
    }).finally(() => setLoading(false));
  }, [id]);

  const t0 = info?.tokenInfo?.[0]?.data?.[0];
  const t1 = info?.tokenInfo?.[1]?.data?.[0];
  const sym0 = t0?.symbol || "?";
  const sym1 = t1?.symbol || "?";
  const primary = t1 || t0;
  const proto = info?.type;

  // Build price chart from token1 (typically SOL/USDC) stats5m..stats24h
  const priceChange = useMemo(() => {
    if (!t1) return [];
    const rows: any[] = [];
    const map: any = { "5m": t1.stats5m, "1h": t1.stats1h, "6h": t1.stats6h, "24h": t1.stats24h };
    for (const k of ["5m", "1h", "6h", "24h"]) {
      const v = map[k];
      if (v) rows.push({ window: k, change: v.priceChange ?? 0, volume: (v.buyVolume ?? 0) + (v.sellVolume ?? 0), buys: v.numBuys ?? 0, sells: v.numSells ?? 0 });
    }
    return rows;
  }, [t1]);

  const buySell = useMemo(() => priceChange.map((r) => ({ window: r.window, buys: r.buys, sells: r.sells })), [priceChange]);

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link to="/pools" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          {loading && !info ? <Skeleton className="h-7 w-48" /> : (
            <div className="flex items-center gap-2">
              {t0?.icon && <img src={t0.icon} className="h-7 w-7 rounded-full" alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}
              {t1?.icon && <img src={t1.icon} className="h-7 w-7 rounded-full -ml-3" alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}
              <h1 className="text-2xl font-semibold">{sym0} / {sym1}</h1>
              <Badge variant="outline" className="text-xs">{protocolLabel(proto)}</Badge>
            </div>
          )}
          <div className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-2">
            {shortAddr(id, 6)}
            <a href={`https://app.meteora.ag/pools/${id}`} target="_blank" rel="noreferrer" className="hover:text-foreground"><ExternalLink className="h-3 w-3" /></a>
          </div>
        </div>
        <Button className="bg-primary text-primary-foreground" onClick={() => setIntent({ kind: "in", pool: { pool: id, token0_symbol: sym0, token1_symbol: sym1, ...info } })}>
          <Zap className="h-4 w-4" /> Zap In
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <Stat label={`${primary?.symbol || sym1} Price`} value={primary?.usdPrice != null ? fmtUsd(primary.usdPrice, { digits: primary.usdPrice < 1 ? 6 : 2 }) : "—"} />
        <Stat label="Market Cap" value={primary?.mcap != null ? fmtUsd(primary.mcap, { compact: true }) : "—"} />
        <Stat label="Liquidity" value={primary?.liquidity != null ? fmtUsd(primary.liquidity, { compact: true }) : "—"} />
        <Stat label="TVL" value={fmtUsd(info?.poolDb?.tvl ?? stats?.total_input_value, { compact: true })} />
        <Stat label="Open Positions" value={fmtNum(stats?.total_open_positions ?? positions.length, 0)} />
        <Stat label="Unique LPers" value={fmtNum(stats?.unique_owners ?? 0, 0)} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <div className="font-semibold text-sm">Price Change ({sym1})</div>
              <div className="text-xs text-muted-foreground">Across timeframes (5m / 1h / 6h / 24h)</div>
            </div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-56">
            {priceChange.length === 0 ? <Empty /> : (
              <ResponsiveContainer>
                <BarChart data={priceChange}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="window" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtPct(Number(v))} />
                  <Bar dataKey="change" radius={[4, 4, 0, 0]}>
                    {priceChange.map((r, i) => (
                      <Bar key={i} dataKey="change" fill={r.change >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="font-semibold text-sm mb-1">Buy vs Sell Pressure</div>
          <div className="text-xs text-muted-foreground mb-2">Trade counts across timeframes</div>
          <div className="h-56">
            {buySell.length === 0 ? <Empty /> : (
              <ResponsiveContainer>
                <BarChart data={buySell}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="window" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmtNum(v, 0)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtNum(v, 0)} />
                  <Bar dataKey="buys" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="sells" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Top LPers */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-semibold">All LPers returned by LP Agent ({topLpers.length})</div>
        {loading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : topLpers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No LP data yet for this pool.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Wallet</TableHead>
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
                  <TableCell className="text-right num text-success">{fmtUsd(l.total_fee, { compact: true })}</TableCell>
                  <TableCell className={`text-right num ${l.total_pnl > 0 ? "text-success" : l.total_pnl < 0 ? "text-destructive" : ""}`}>{fmtUsd(l.total_pnl, { compact: true })}</TableCell>
                  <TableCell className={`text-right num ${l.roi > 0 ? "text-success" : "text-destructive"}`}>{fmtPct((l.roi ?? 0) * 100)}</TableCell>
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

const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 } as const;
const Empty = () => <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data</div>;
