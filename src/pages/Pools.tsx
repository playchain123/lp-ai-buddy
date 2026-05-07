import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { lp, fmtUsd, fmtPct, shortAddr, listRows, protocolLabel } from "@/lib/lpAgent";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PulseCell } from "@/components/PulseCell";
import { TokenIcon } from "@/components/TokenIcon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Zap, ArrowUpDown, ExternalLink, Flame } from "lucide-react";
import { ZapDrawer, ZapIntent } from "@/components/ZapDrawer";

type Sort = "tvl" | "vol_24h" | "fee_tvl_ratio" | "mcap";
const SORT_LABELS: Record<Sort, string> = {
  vol_24h: "Volume 24h", tvl: "TVL", mcap: "Market Cap", fee_tvl_ratio: "Fee/TVL",
};

const dollarsCompact = (n: number) => fmtUsd(n, { compact: true });
const dollarsPrice = (n: number) => fmtUsd(n, { digits: n < 1 ? 6 : 2 });

// Real 24h fees in USD = vol_24h * fee%
const feeUsd24h = (p: any) => (Number(p.vol_24h || 0) * Number(p.fee || 0)) / 100;

export default function Pools() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState(params.get("search") || "");
  const [sortBy, setSortBy] = useState<Sort>("vol_24h");
  const [pools, setPools] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [intent, setIntent] = useState<ZapIntent | null>(null);

  const load = async (silent = false) => {
    if (!silent && pools.length === 0) setLoading(true);
    try {
      const res = await lp("discoverPools", { search: search || undefined, sortBy, sortOrder: "desc", pageSize: 50 });
      setPools(listRows(res));
      if (!search) {
        const tr = await lp("discoverPools", { sortBy: "vol_24h", sortOrder: "desc", pageSize: 12 });
        const rows = listRows(tr).sort((a, b) => Number(b.vol_1h || 0) - Number(a.vol_1h || 0)).slice(0, 8);
        setTrending(rows);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sortBy]);
  useEffect(() => { const id = setInterval(() => load(true), 5_000); return () => clearInterval(id); /* eslint-disable-next-line */ }, [sortBy, search]);

  // Live debounce search
  useEffect(() => {
    const id = setTimeout(() => {
      setParams(search ? { search } : {});
      load();
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line
  }, [search]);

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Discover Pools</h1>
          <p className="text-sm text-muted-foreground">Meteora DLMM &amp; DAMM v2 — live data via LP Agent · auto-refresh 15s</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search token (SOL, USDC, JUP, mint…)" className="pl-9 h-10 bg-card" />
        </div>
      </div>

      {trending.length > 0 && !search && (
        <div className="mb-4 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-warning" /> Trending now · zap in to ride momentum
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {trending.map((p) => (
              <button
                key={p.pool}
                onClick={() => navigate(`/pools/${p.pool}`)}
                className="shrink-0 rounded-md border border-border bg-background hover:border-primary/50 px-3 py-2 text-left transition-colors min-w-[200px]"
              >
                <div className="flex items-center gap-2">
                  <span className="flex"><TokenIcon mint={p.token0} symbol={p.token0_symbol} size={18} /><TokenIcon mint={p.token1} symbol={p.token1_symbol} size={18} className="-ml-1.5" /></span>
                  <span className="text-sm font-medium">{p.token0_symbol}/{p.token1_symbol}</span>
                  <PulseCell value={Number(p.price_1h_change || 0)} />
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 num">Vol 1h <AnimatedNumber value={Number(p.vol_1h || 0)} format={dollarsCompact} /></div>
              </button>
            ))}
          </div>
        </div>
      )}

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
                <TableHead className="text-right">Fees 24h</TableHead>
                <TableHead className="text-right">5m</TableHead>
                <TableHead className="text-right">1h</TableHead>
                <TableHead className="text-right">24h</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pools.map((p, i) => (
                <TableRow key={p.pool || i} className="hover:bg-secondary/40 cursor-pointer" onClick={() => navigate(`/pools/${p.pool}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      <span className="flex items-center">
                        <TokenIcon mint={p.token0} symbol={p.token0_symbol} size={20} />
                        <TokenIcon mint={p.token1} symbol={p.token1_symbol} size={20} className="-ml-1.5" />
                      </span>
                      {p.token0_symbol || "?"} / {p.token1_symbol || "?"}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                      {shortAddr(p.pool, 4)}
                      <a onClick={(e) => e.stopPropagation()} href={`https://app.meteora.ag/pools/${p.pool}`} target="_blank" rel="noreferrer" className="hover:text-foreground"><ExternalLink className="h-3 w-3" /></a>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{protocolLabel(p.protocol)}</Badge></TableCell>
                  <TableCell className="text-right"><AnimatedNumber value={Number(p.usd_price || 0)} format={dollarsPrice} /></TableCell>
                  <TableCell className="text-right"><AnimatedNumber value={Number(p.tvl || 0)} format={dollarsCompact} /></TableCell>
                  <TableCell className="text-right"><AnimatedNumber value={Number(p.vol_24h || 0)} format={dollarsCompact} /></TableCell>
                  <TableCell className="text-right"><AnimatedNumber value={feeUsd24h(p)} format={dollarsCompact} /></TableCell>
                  <TableCell className="text-right"><PulseCell value={Number(p.price_5m_change || 0)} /></TableCell>
                  <TableCell className="text-right"><PulseCell value={Number(p.price_1h_change || 0)} /></TableCell>
                  <TableCell className="text-right"><PulseCell value={Number(p.price_24h_change || 0)} /></TableCell>
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
