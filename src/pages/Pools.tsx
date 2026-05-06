import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { lp, fmtUsd, fmtPct, shortAddr, listRows, protocolLabel } from "@/lib/lpAgent";
import { tokenIcon } from "@/lib/gecko";
import { PulseCell } from "@/components/PulseCell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Zap, ArrowUpDown, ExternalLink } from "lucide-react";
import { ZapDrawer, ZapIntent } from "@/components/ZapDrawer";

type Sort = "tvl" | "vol_24h" | "fee_tvl_ratio" | "mcap";
const SORT_LABELS: Record<Sort, string> = {
  vol_24h: "Volume 24h", tvl: "TVL", mcap: "Market Cap", fee_tvl_ratio: "Fee/TVL",
};

const PoolIcon = ({ mint, sym }: { mint?: string; sym: string }) => {
  const [err, setErr] = useState(false);
  const url = tokenIcon(mint);
  if (!url || err) return <span className="h-5 w-5 rounded-full bg-secondary inline-flex items-center justify-center text-[9px] font-medium">{sym.slice(0, 2)}</span>;
  return <img src={url} alt={sym} className="h-5 w-5 rounded-full bg-secondary" onError={() => setErr(true)} />;
};

export default function Pools() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState(params.get("search") || "");
  const [sortBy, setSortBy] = useState<Sort>("vol_24h");
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [intent, setIntent] = useState<ZapIntent | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await lp("discoverPools", { search: search || undefined, sortBy, sortOrder: "desc", pageSize: 50 });
      setPools(listRows(res));
    } catch (e) {
      console.error(e);
      if (!silent) setPools([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sortBy]);
  useEffect(() => { const id = setInterval(() => load(true), 20_000); return () => clearInterval(id); /* eslint-disable-next-line */ }, [sortBy, search]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setParams(search ? { search } : {});
    load();
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Discover Pools</h1>
          <p className="text-sm text-muted-foreground">Meteora DLMM &amp; DAMM v2 — live data via LP Agent · auto-refresh 20s</p>
        </div>
        <form onSubmit={onSearch} className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search token (SOL, USDC, JUP…)" className="pl-9 h-10 bg-card" />
          </div>
          <Button type="submit" variant="outline">Search</Button>
        </form>
      </div>

      <div className="flex items-center gap-2 mb-3 text-xs flex-wrap">
        <span className="text-muted-foreground">Sort:</span>
        {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
          <Button key={s} size="sm" variant={sortBy === s ? "default" : "outline"} className="h-7" onClick={() => setSortBy(s)}>
            <ArrowUpDown className="h-3 w-3" />{SORT_LABELS[s]}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : pools.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No pools found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pool</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">TVL</TableHead>
                <TableHead className="text-right">Vol 24h</TableHead>
                <TableHead className="text-right">Vol 1h</TableHead>
                <TableHead className="text-right">5m</TableHead>
                <TableHead className="text-right">1h</TableHead>
                <TableHead className="text-right">24h</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pools.map((p, i) => (
                <TableRow key={p.pool || i} className="hover:bg-secondary/40 cursor-pointer" onClick={() => navigate(`/pools/${p.pool}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      <span className="flex items-center">
                        <PoolIcon mint={p.token0} sym={p.token0_symbol || "?"} />
                        <span className="-ml-1.5"><PoolIcon mint={p.token1} sym={p.token1_symbol || "?"} /></span>
                      </span>
                      {p.token0_symbol || "?"} / {p.token1_symbol || "?"}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                      {shortAddr(p.pool, 4)}
                      <a onClick={(e) => e.stopPropagation()} href={`https://app.meteora.ag/pools/${p.pool}`} target="_blank" rel="noreferrer" className="hover:text-foreground"><ExternalLink className="h-3 w-3" /></a>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{protocolLabel(p.protocol)}</Badge></TableCell>
                  <TableCell className="text-right num">{p.usd_price ? fmtUsd(p.usd_price, { digits: p.usd_price < 1 ? 6 : 2 }) : "—"}</TableCell>
                  <TableCell className="text-right num">{fmtUsd(p.tvl, { compact: true })}</TableCell>
                  <TableCell className="text-right num">{fmtUsd(p.vol_24h, { compact: true })}</TableCell>
                  <TableCell className="text-right num text-muted-foreground">{fmtUsd(p.vol_1h, { compact: true })}</TableCell>
                  <TableCell className="text-right"><PulseCell value={Number(p.price_5m_change || 0)} /></TableCell>
                  <TableCell className="text-right"><PulseCell value={Number(p.price_1h_change || 0)} /></TableCell>
                  <TableCell className="text-right"><PulseCell value={Number(p.price_24h_change || 0)} /></TableCell>
                  <TableCell className="text-right num">{fmtPct(Number(p.fee || 0))}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" className="bg-primary text-primary-foreground" onClick={(e) => { e.stopPropagation(); setIntent({ kind: "in", pool: p }); }}>
                      <Zap className="h-3.5 w-3.5" /> Zap In
                    </Button>
                  </TableCell>
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
