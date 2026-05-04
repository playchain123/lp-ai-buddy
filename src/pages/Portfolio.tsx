import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useWallet } from "@/wallet/WalletProvider";
import {
  lp, fmtUsd, fmtPct, pick, shortAddr,
  firstRow, listRows, rangeVal, normalizePosition, protocolLabel,
} from "@/lib/lpAgent";
import { Stat } from "@/components/Stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wallet, ExternalLink, Sparkles, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { ZapDrawer, ZapIntent } from "@/components/ZapDrawer";
import { toast } from "@/hooks/use-toast";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";

type Range = "ALL" | "7D" | "1M" | "3M" | "1Y" | "YTD";

export default function Portfolio() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { address: myAddr, connected, connect } = useWallet();
  const queryWallet = params.get("wallet");
  const wallet = queryWallet || myAddr;

  const [overview, setOverview] = useState<any>(null);
  const [positionsRaw, setPositionsRaw] = useState<any[]>([]);
  const [historical, setHistorical] = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [intent, setIntent] = useState<ZapIntent | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [range, setRange] = useState<Range>("7D");

  useEffect(() => {
    if (!wallet) { setOverview(null); setPositionsRaw([]); setHistorical([]); setRevenue([]); return; }
    let cancel = false;
    setLoading(true);
    Promise.allSettled([
      lp("portfolioOverview", { owner: wallet }),
      lp("openPositions", { owner: wallet, pageSize: 100 }),
      lp("historicalPositions", { owner: wallet, pageSize: 100 }),
      lp("revenue", { owner: wallet, range }),
    ]).then((res) => {
      if (cancel) return;
      const [o, p, h, r] = res;
      setOverview(o.status === "fulfilled" ? firstRow(o.value) : {});
      setPositionsRaw(p.status === "fulfilled" ? listRows(p.value) : []);
      setHistorical(h.status === "fulfilled" ? listRows(h.value) : []);
      setRevenue(r.status === "fulfilled" ? listRows(r.value) : []);
      if (p.status === "rejected") toast({ title: "Couldn't load positions", description: String(p.reason).slice(0, 160), variant: "destructive" });
    }).finally(() => !cancel && setLoading(false));
    return () => { cancel = true; };
  }, [wallet, refreshKey, range]);

  const positions = useMemo(() => positionsRaw.map(normalizePosition), [positionsRaw]);
  const closed = useMemo(() => historical.map(normalizePosition), [historical]);

  const kpis = useMemo(() => {
    const o = overview || {};
    const totalValue = positions.reduce((s, p) => s + (p.currentValue || 0), 0);
    const fees = rangeVal(o.total_fee, range) ?? 0;
    const pnl = rangeVal(o.total_pnl, range) ?? 0;
    const winRate = rangeVal(o.win_rate, range);
    const inflow = rangeVal(o.avg_inflow, range);
    const inRangeCount = positions.filter((p) => p.inRange).length;
    const inRangePct = positions.length ? (inRangeCount / positions.length) * 100 : null;
    return {
      totalValue,
      pnl,
      pnlPct: inflow ? (pnl / inflow) * 100 : null,
      fees,
      apr: o.apr ?? null,
      roi: o.roi != null ? o.roi * 100 : null,
      winRate: winRate != null ? winRate * 100 : null,
      open: positions.length,
      closed: rangeVal(o.closed_lp, range) ?? closed.length,
      inRangePct,
    };
  }, [overview, positions, closed, range]);

  // Performance chart from revenue series
  const perfData = useMemo(() => {
    return (revenue || [])
      .map((r: any) => ({
        date: r.date || r.day || r.time || r.timestamp,
        value: Number(r.value ?? r.pnl ?? r.fee ?? 0),
        fee: Number(r.fee ?? 0),
        pnl: Number(r.pnl ?? 0),
      }))
      .filter((r) => r.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [revenue]);

  // Allocation (pie) from open positions
  const allocation = useMemo(() => {
    const map = new Map<string, number>();
    positions.forEach((p) => {
      map.set(p.pair, (map.get(p.pair) || 0) + (p.currentValue || 0));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [positions]);

  const PIE_COLORS = ["#5b8cff", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#ef4444", "#84cc16"];

  if (!wallet) return <div className="p-8"><ConnectPrompt onConnect={connect} /></div>;

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Wallet</div>
          <div className="flex items-center gap-2 mt-0.5">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-sm">{shortAddr(wallet, 6)}</span>
            {queryWallet && <Badge variant="outline" className="text-xs">read-only</Badge>}
            <a href={`https://solscan.io/account/${wallet}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-card rounded-md border border-border p-0.5">
            {(["7D", "1M", "3M", "1Y", "ALL"] as Range[]).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`text-xs px-2.5 h-7 rounded ${range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{r}</button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => navigate("/chat")}>
            <Sparkles className="h-3.5 w-3.5" /> Ask Copilot
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {loading && !overview ? (
          <>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[88px]" />)}</>
        ) : (
          <>
            <Stat label="Total LP Value" value={fmtUsd(kpis.totalValue)} hint={`${kpis.open} open`} />
            <Stat label={`PnL (${range})`} value={fmtUsd(kpis.pnl)} delta={kpis.pnlPct != null ? { value: kpis.pnlPct, suffix: "%" } : null} />
            <Stat label={`Fees (${range})`} value={fmtUsd(kpis.fees)} />
            <Stat label="APR" value={kpis.apr != null ? fmtPct(kpis.apr) : "—"} />
            <Stat label="Win Rate" value={kpis.winRate != null ? fmtPct(kpis.winRate, 1) : "—"} />
            <Stat label="In Range" value={kpis.inRangePct != null ? fmtPct(kpis.inRangePct, 0) : "—"} />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-semibold text-sm">Revenue & PnL</div>
              <div className="text-xs text-muted-foreground">Daily fee income and realized PnL · {range}</div>
            </div>
            {kpis.pnl >= 0 ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
          </div>
          <div className="h-56">
            {perfData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No revenue history in this range.</div>
            ) : (
              <ResponsiveContainer>
                <AreaChart data={perfData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gFee" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gPnl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmtUsd(v, { compact: true })} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => fmtUsd(v)}
                  />
                  <Area type="monotone" dataKey="fee" stroke="hsl(var(--success))" fill="url(#gFee)" strokeWidth={2} />
                  <Area type="monotone" dataKey="pnl" stroke="hsl(var(--primary))" fill="url(#gPnl)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="font-semibold text-sm mb-1">Allocation</div>
          <div className="text-xs text-muted-foreground mb-2">Open positions by pair</div>
          <div className="h-56">
            {allocation.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No open positions.</div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={allocation} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {allocation.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any, n: any) => [fmtUsd(v), n]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="open" className="space-y-3">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="open">Open Positions ({positions.length})</TabsTrigger>
          <TabsTrigger value="closed">History ({closed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          <PositionsTable positions={positions} loading={loading} readOnly={!!queryWallet} onZapOut={(p) => setIntent({ kind: "out", position: p.raw })} emptyHint="No open Meteora LP positions for this wallet." />
        </TabsContent>
        <TabsContent value="closed">
          <PositionsTable positions={closed} loading={loading} readOnly closed emptyHint="No closed positions in this range." />
        </TabsContent>
      </Tabs>

      <ZapDrawer intent={intent} onClose={() => setIntent(null)} />
    </div>
  );
}

function PositionsTable({ positions, loading, readOnly, closed, onZapOut, emptyHint }: {
  positions: ReturnType<typeof normalizePosition>[];
  loading: boolean; readOnly?: boolean; closed?: boolean;
  onZapOut?: (p: ReturnType<typeof normalizePosition>) => void;
  emptyHint: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {loading && positions.length === 0 ? (
        <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : positions.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">{emptyHint}</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pair</TableHead>
              <TableHead>Protocol</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">Fees</TableHead>
              <TableHead className="text-right">PnL</TableHead>
              <TableHead className="text-right">PnL %</TableHead>
              {!closed && <TableHead>Range</TableHead>}
              <TableHead className="text-right">Age</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((p) => (
              <TableRow key={p.id} className="hover:bg-secondary/40">
                <TableCell>
                  <div className="flex items-center gap-2">
                    {p.logo0 && <img src={p.logo0} alt="" className="h-5 w-5 rounded-full" onError={(e) => (e.currentTarget.style.display = "none")} />}
                    <span className="font-medium">{p.pair}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">{shortAddr(p.pool, 4)}</div>
                </TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{protocolLabel(p.protocol)}</Badge></TableCell>
                <TableCell className="text-right num">{fmtUsd(p.currentValue)}</TableCell>
                <TableCell className="text-right num text-success">{fmtUsd(p.fees)}</TableCell>
                <TableCell className={`text-right num ${p.pnl > 0 ? "text-success" : p.pnl < 0 ? "text-destructive" : ""}`}>{fmtUsd(p.pnl)}</TableCell>
                <TableCell className={`text-right num ${p.pnlPct > 0 ? "text-success" : p.pnlPct < 0 ? "text-destructive" : ""}`}>{fmtPct(p.pnlPct)}</TableCell>
                {!closed && (
                  <TableCell>
                    <Badge className={p.inRange ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning border-warning/30"} variant="outline">
                      {p.inRange ? "In range" : "Out"}
                    </Badge>
                  </TableCell>
                )}
                <TableCell className="text-right num text-muted-foreground text-xs">{fmtAge(p.ageHour)}</TableCell>
                <TableCell className="text-right">
                  {!readOnly && onZapOut ? (
                    <Button size="sm" variant="outline" onClick={() => onZapOut(p)}>Zap Out</Button>
                  ) : (
                    <a href={`https://solscan.io/account/${p.id}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground inline-block">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function fmtAge(h: number) {
  if (!h) return "—";
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
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
      <p className="text-xs text-muted-foreground mt-4">Or paste any wallet address in the search bar above to inspect read-only.</p>
    </div>
  );
}
