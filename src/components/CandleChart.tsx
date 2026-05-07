import { useEffect, useMemo, useRef, useState } from "react";
import { Candle, Tf, gtOhlcv } from "@/lib/gecko";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtUsd, fmtPct } from "@/lib/lpAgent";

type Preset = { id: string; label: string; tf: Tf; agg: number };
const PRESETS: Preset[] = [
  { id: "30m", label: "30m", tf: "minute", agg: 30 },
  { id: "1h", label: "1H", tf: "hour", agg: 1 },
  { id: "4h", label: "4H", tf: "hour", agg: 4 },
  { id: "1d", label: "1D", tf: "day", agg: 1 },
];

export function CandleChart({ pool, quoteSymbol }: { pool: string; quoteSymbol?: string }) {
  const [tf, setTf] = useState<Preset>(PRESETS[1]);
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [hover, setHover] = useState<Candle | null>(null);

  useEffect(() => {
    let cancel = false;
    setCandles(null);
    gtOhlcv(pool, tf.tf, tf.agg, 120).then((c) => { if (!cancel) setCandles(c); });
    const id = setInterval(() => gtOhlcv(pool, tf.tf, tf.agg, 120).then((c) => !cancel && setCandles(c)), 30_000);
    return () => { cancel = true; clearInterval(id); };
  }, [pool, tf.id]);

  const stats = useMemo(() => {
    if (!candles?.length) return null;
    const first = candles[0].o;
    const last = candles[candles.length - 1].c;
    const change = first ? ((last - first) / first) * 100 : 0;
    const totalVol = candles.reduce((a, c) => a + c.v, 0);
    const high = Math.max(...candles.map((c) => c.h));
    const low = Math.min(...candles.map((c) => c.l));
    return { last, change, totalVol, high, low };
  }, [candles]);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex flex-wrap items-stretch border-b border-border">
        <div className="flex-1 min-w-[200px] px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Last Price · {quoteSymbol || ""}</div>
          {stats && (
            <div className="flex items-baseline gap-3 mt-0.5">
              <span className={`text-2xl font-semibold num ${stats.change >= 0 ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}`}>
                {fmtUsd(stats.last, { digits: stats.last < 1 ? 6 : 4 })}
              </span>
              <span className={`text-sm num ${stats.change >= 0 ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}`}>
                {stats.change >= 0 ? "+" : ""}{fmtPct(stats.change)}
              </span>
            </div>
          )}
        </div>
        {stats && (
          <div className="hidden md:grid grid-cols-3 border-l border-border text-[11px]">
            <Cell label={`${tf.label} High`} value={fmtUsd(stats.high, { digits: 6 })} />
            <Cell label={`${tf.label} Low`} value={fmtUsd(stats.low, { digits: 6 })} />
            <Cell label={`${tf.label} Volume`} value={fmtUsd(stats.totalVol, { compact: true })} />
          </div>
        )}
        <div className="flex items-center gap-1 px-2 border-l border-border">
          {PRESETS.map((p) => (
            <Button key={p.id} size="sm" variant={tf.id === p.id ? "default" : "ghost"} className="h-7 px-2.5 text-xs" onClick={() => setTf(p)}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="h-[420px] relative">
        {!candles ? <Skeleton className="h-full w-full" /> : candles.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No OHLCV available for this pair yet.</div>
        ) : <CandleSvg candles={candles} onHover={setHover} />}
        {hover && (
          <div className="absolute top-2 left-2 bg-background/90 border border-border rounded px-2 py-1 text-[11px] num pointer-events-none">
            <div className="text-muted-foreground">{new Date(hover.t).toLocaleString()}</div>
            <div>O {fmtUsd(hover.o, { digits: 6 })} · C {fmtUsd(hover.c, { digits: 6 })}</div>
            <div>H {fmtUsd(hover.h, { digits: 6 })} · L {fmtUsd(hover.l, { digits: 6 })}</div>
            <div>V {fmtUsd(hover.v, { compact: true })}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 border-l border-border first:border-l-0 min-w-[110px]">
      <div className="text-muted-foreground">{label}</div>
      <div className="num text-foreground text-xs">{value}</div>
    </div>
  );
}

function CandleSvg({ candles, onHover }: { candles: Candle[]; onHover: (c: Candle | null) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const W = 800, H = 280, padL = 50, padR = 8, padT = 8, padB = 60;
  const cw = (W - padL - padR) / candles.length;
  const max = Math.max(...candles.map((c) => c.h));
  const min = Math.min(...candles.map((c) => c.l));
  const vMax = Math.max(...candles.map((c) => c.v));
  const priceH = H - padT - padB - 50;
  const volTop = H - padB - 40;
  const yPrice = (p: number) => padT + (1 - (p - min) / (max - min || 1)) * priceH;
  const yVol = (v: number) => volTop + (1 - v / (vMax || 1)) * 35 + 5;

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none"
      onMouseLeave={() => onHover(null)}
    >
      {/* y grid */}
      {[0.25, 0.5, 0.75].map((p) => (
        <line key={p} x1={padL} x2={W - padR} y1={padT + priceH * p} y2={padT + priceH * p} stroke="hsl(var(--border))" strokeDasharray="2 3" />
      ))}
      {/* price labels */}
      {[0, 0.5, 1].map((p) => (
        <text key={p} x={4} y={padT + priceH * (1 - p) + 4} fontSize="9" fill="hsl(var(--muted-foreground))">
          {(min + (max - min) * p).toExponential(2)}
        </text>
      ))}
      {candles.map((c, i) => {
        const x = padL + i * cw + cw / 2;
        const up = c.c >= c.o;
        const color = up ? "hsl(var(--success))" : "hsl(var(--destructive))";
        const yo = yPrice(c.o), yc = yPrice(c.c);
        return (
          <g key={i} onMouseEnter={() => onHover(c)}>
            <rect x={padL + i * cw} y={padT} width={cw} height={H - padT - padB} fill="transparent" />
            <line x1={x} x2={x} y1={yPrice(c.h)} y2={yPrice(c.l)} stroke={color} strokeWidth="1" />
            <rect x={x - cw * 0.35} y={Math.min(yo, yc)} width={cw * 0.7} height={Math.max(1, Math.abs(yc - yo))} fill={color} />
            <rect x={x - cw * 0.35} y={yVol(c.v)} width={cw * 0.7} height={Math.max(1, volTop + 40 - yVol(c.v))} fill={color} opacity="0.35" />
          </g>
        );
      })}
    </svg>
  );
}
