import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { lp, fmtUsd, fmtPct, pick, shortAddr } from "@/lib/lpAgent";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Zap, ArrowUpDown, ExternalLink } from "lucide-react";
import { ZapDrawer, ZapIntent } from "@/components/ZapDrawer";

type Sort = "tvl" | "volume24h" | "apr";

export default function Pools() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const [sortBy, setSortBy] = useState<Sort>("volume24h");
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [intent, setIntent] = useState<ZapIntent | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const sortKey = sortBy === "volume24h" ? "vol_24h" : sortBy === "tvl" ? "tvl" : "apr";
      const res = await lp("discoverPools", { search: search || undefined, sortBy: sortKey, pageSize: 30 });
      const list = Array.isArray(res) ? res : (res?.data || res?.pools || res?.items || []);
      setPools(list);
    } catch (e) {
      console.error(e);
      setPools([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sortBy]);
  // initial search from URL
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
          <p className="text-sm text-muted-foreground">Meteora DLMM &amp; DAMM v2 pools, ranked by liquidity, volume and APR.</p>
        </div>
        <form onSubmit={onSearch} className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search token (SOL, USDC, JUP…)" className="pl-9 h-10 bg-card" />
          </div>
          <Button type="submit" variant="outline">Search</Button>
        </form>
      </div>

      <div className="flex items-center gap-2 mb-3 text-xs">
        <span className="text-muted-foreground">Sort:</span>
        {(["volume24h", "tvl", "apr"] as Sort[]).map((s) => (
          <Button key={s} size="sm" variant={sortBy === s ? "default" : "outline"} className="h-7" onClick={() => setSortBy(s)}>
            <ArrowUpDown className="h-3 w-3" />
            {s === "tvl" ? "TVL" : s === "volume24h" ? "Volume 24h" : "APR"}
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
                <TableHead className="text-right">TVL</TableHead>
                <TableHead className="text-right">Volume 24h</TableHead>
                <TableHead className="text-right">Fees 24h</TableHead>
                <TableHead className="text-right">APR</TableHead>
                <TableHead>Type</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pools.map((p, i) => {
                const addr = pick(p, ["pool", "address", "poolAddress", "id", "poolId"]);
                const t0 = pick(p, ["token0_symbol", "token0.symbol", "tokenX.symbol", "baseToken.symbol"], "?");
                const t1 = pick(p, ["token1_symbol", "token1.symbol", "tokenY.symbol", "quoteToken.symbol"], "?");
                const name = pick(p, ["pair", "name"]) || `${t0}/${t1}`;
                const tvl = pick(p, ["tvl", "tvlUsd", "liquidity", "liquidityUsd"]);
                const vol = pick(p, ["vol_24h", "volume24h", "volume24hUsd"]);
                const fees = pick(p, ["fees_24h", "fee_24h", "fees24h"]);
                const apr = pick(p, ["apr", "apr_24h", "apr24h"]);
                const type = pick(p, ["protocol", "type", "version"]) || "DLMM";
                return (
                  <TableRow key={addr || i} className="hover:bg-secondary/40">
                    <TableCell>
                      <div className="font-medium">{name}</div>
                      <div className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                        {shortAddr(addr, 4)}
                        {addr && <a href={`https://app.meteora.ag/dlmm/${addr}`} target="_blank" rel="noreferrer" className="hover:text-foreground"><ExternalLink className="h-3 w-3" /></a>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right num">{fmtUsd(tvl, { compact: true })}</TableCell>
                    <TableCell className="text-right num">{fmtUsd(vol, { compact: true })}</TableCell>
                    <TableCell className="text-right num text-positive">{fees != null ? fmtUsd(fees, { compact: true }) : "—"}</TableCell>
                    <TableCell className="text-right num font-semibold">{apr != null ? fmtPct(apr) : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{String(type).toUpperCase()}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => setIntent({ kind: "in", pool: p })}>
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
