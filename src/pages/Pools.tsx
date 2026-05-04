import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { lp, fmtUsd, fmtPct, pick, shortAddr, listRows, protocolLabel } from "@/lib/lpAgent";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Zap, ArrowUpDown, ExternalLink, TrendingUp, TrendingDown } from "lucide-react";
import { ZapDrawer, ZapIntent } from "@/components/ZapDrawer";

type Sort = "tvl" | "vol_24h" | "fee" | "vol_1h";

const SORT_LABELS: Record<Sort, string> = {
  tvl: "TVL",
  vol_24h: "Volume 24h",
  vol_1h: "Volume 1h",
  fee: "Fee tier",
};

export default function Pools() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState(params.get("search") || "");
  const [sortBy, setSortBy] = useState<Sort>("vol_24h");
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [intent, setIntent] = useState<ZapIntent | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await lp("discoverPools", { search: search || undefined, sortBy, sortOrder: "desc", pageSize: 30 });
      setPools(listRows(res));
    } catch (e) {
      console.error(e);
      setPools([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sortBy]);
  useEffect(() => { if (params.get("search")) load(); /* eslint-disable-next-line */ }, []);

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
          <p className="text-sm text-muted-foreground">Meteora DLMM &amp; DAMM v2 pools — live data via LP Agent.</p>
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
            <ArrowUpDown className="h-3 w-3" />
            {SORT_LABELS[s]}
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
                <TableHead className="text-right">TVL</TableHead>
                <TableHead className="text-right">Vol 24h</TableHead>
                <TableHead className="text-right">Vol 1h</TableHead>
                <TableHead className="text-right">24h Δ</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pools.map((p, i) => {
                const addr = pick(p, ["pool", "address", "id"]);
                const t0 = pick(p, ["token0_symbol"], "?");
                const t1 = pick(p, ["token1_symbol"], "?");
                const tvl = pick(p, ["tvl"]);
                const vol24 = pick(p, ["vol_24h"]);
                const vol1h = pick(p, ["vol_1h"]);
                const change24 = Number(pick(p, ["price_24h_change"], 0));
                const fee = Number(pick(p, ["fee"], 0));
                const proto = pick(p, ["protocol"]);
                return (
                  <TableRow key={addr || i} className="hover:bg-secondary/40 cursor-pointer" onClick={() => navigate(`/pools/${addr}`)}>
                    <TableCell>
                      <div className="font-medium">{t0} / {t1}</div>
                      <div className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                        {shortAddr(addr, 4)}
                        <a onClick={(e) => e.stopPropagation()} href={`https://app.meteora.ag/pools/${addr}`} target="_blank" rel="noreferrer" className="hover:text-foreground"><ExternalLink className="h-3 w-3" /></a>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{protocolLabel(proto)}</Badge></TableCell>
                    <TableCell className="text-right num">{fmtUsd(tvl, { compact: true })}</TableCell>
                    <TableCell className="text-right num">{fmtUsd(vol24, { compact: true })}</TableCell>
                    <TableCell className="text-right num text-muted-foreground">{fmtUsd(vol1h, { compact: true })}</TableCell>
                    <TableCell className={`text-right num ${change24 > 0 ? "text-success" : change24 < 0 ? "text-destructive" : ""}`}>
                      <span className="inline-flex items-center gap-0.5">
                        {change24 > 0 ? <TrendingUp className="h-3 w-3" /> : change24 < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                        {fmtPct(change24)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right num">{fee.toFixed(2)}%</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" className="bg-primary text-primary-foreground" onClick={(e) => { e.stopPropagation(); setIntent({ kind: "in", pool: p }); }}>
                        <Zap className="h-3.5 w-3.5" /> Zap In
                      </Button>
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
