import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { livePoolOhlcv, type Candle, type MarketTf } from "@/lib/gecko";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtPct, fmtUsd } from "@/lib/lpAgent";

type Preset = { id: MarketTf; label: string };
const PRESETS: Preset[] = [
  { id: "15m", label: "15m" },
  { id: "30m", label: "30m" },
  { id: "1h", label: "1H" },
  { id: "4h", label: "4H" },
  { id: "1d", label: "1D" },
];

const cssHsl = (token: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value ? `hsl(${value})` : fallback;
};

const cssHsla = (token: string, alpha: number, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value ? `hsl(${value} / ${alpha})` : fallback;
};

export function CandleChart({ pool, quoteSymbol, pairLabel }: { pool: string; quoteSymbol?: string; pairLabel?: string }) {
  const [tf, setTf] = useState<Preset>(PRESETS[3]);
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [hover, setHover] = useState<Candle | null>(null);
  const [crosshairPoint, setCrosshairPoint] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesRef = useRef<Candle[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: cssHsl("--background", "#07080a") },
        textColor: cssHsl("--muted-foreground", "#8a8f98"),
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: cssHsla("--border", 0.42, "hsl(220 13% 18% / 0.42)") },
        horzLines: { color: cssHsla("--border", 0.42, "hsl(220 13% 18% / 0.42)") },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: cssHsl("--accent", "#3b82f6"), labelBackgroundColor: cssHsl("--accent", "#3b82f6") },
        horzLine: { color: cssHsl("--destructive", "#ef4444"), labelBackgroundColor: cssHsl("--destructive", "#ef4444") },
      },
      rightPriceScale: {
        borderColor: cssHsl("--border", "#252932"),
      },
      timeScale: {
        borderColor: cssHsl("--border", "#252932"),
        barSpacing: 5,
        minBarSpacing: 2,
        maxBarSpacing: 7,
        rightOffset: 8,
        rightBarStaysOnScroll: true,
        timeVisible: true,
        secondsVisible: false,
      },
      localization: {
        priceFormatter: (price: number) => fmtUsd(price, { digits: price < 1 ? 6 : 2 }),
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: cssHsl("--success", "#22c55e"),
      downColor: cssHsl("--destructive", "#ef4444"),
      borderVisible: true,
      borderUpColor: cssHsl("--success", "#22c55e"),
      borderDownColor: cssHsl("--destructive", "#ef4444"),
      wickVisible: true,
      wickUpColor: cssHsl("--success", "#22c55e"),
      wickDownColor: cssHsl("--destructive", "#ef4444"),
      priceLineVisible: true,
      lastValueVisible: true,
      priceScaleId: "right",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: "",
      priceFormat: { type: "volume" },
    });

    chart.priceScale("right").applyOptions({
      scaleMargins: { top: 0.12, bottom: 0.25 },
      entireTextOnly: true,
    });
    chart.priceScale("").applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });

    chart.subscribeCrosshairMove((param) => {
      const time = typeof param.time === "number" ? param.time * 1000 : null;
      if (!time || !param.point) {
        setHover(null);
        setCrosshairPoint(null);
        return;
      }
      const match = candlesRef.current.find((c) => Math.floor(c.t / 1000) === Math.floor(time / 1000)) || null;
      setHover(match);
      setCrosshairPoint({ x: param.point.x, y: param.point.y });
    });

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height: 360 });
    });
    resizeObserver.observe(container);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      const next = await livePoolOhlcv(pool, tf.id, 160);
      if (!cancel) setCandles(next);
    };

    setCandles(null);
    load();
    const id = setInterval(load, 5_000);
    return () => {
      cancel = true;
      clearInterval(id);
    };
  }, [pool, tf.id]);

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !candles?.length) return;

    const prev = candlesRef.current;
    const sameSeries = prev.length && candles.length >= prev.length && prev[0]?.t === candles[0]?.t;
    candlesRef.current = candles;

    const up = cssHsl("--success", "#22c55e");
    const dn = cssHsl("--destructive", "#ef4444");

    if (sameSeries) {
      // stream-update only the tail to keep chart smooth & "live"
      const tail = candles.slice(prev.length - 1);
      tail.forEach((c) => {
        candleSeriesRef.current!.update({
          time: Math.floor(c.t / 1000) as any,
          open: c.o, high: c.h, low: c.l, close: c.c,
        });
        volumeSeriesRef.current!.update({
          time: Math.floor(c.t / 1000) as any,
          value: c.v,
          color: c.c >= c.o ? up : dn,
        });
      });
    } else {
      candleSeriesRef.current.setData(
        candles.map((c) => ({
          time: Math.floor(c.t / 1000) as any,
          open: c.o, high: c.h, low: c.l, close: c.c,
        }))
      );
      volumeSeriesRef.current.setData(
        candles.map((c) => ({
          time: Math.floor(c.t / 1000) as any,
          value: c.v,
          color: c.c >= c.o ? up : dn,
        }))
      );
      chartRef.current?.timeScale().setVisibleLogicalRange({
        from: Math.max(0, candles.length - 78),
        to: candles.length + 8,
      });
    }
  }, [candles]);

  const stats = useMemo(() => {
    if (!candles?.length) return null;
    const active = hover || candles[candles.length - 1];
    const first = candles[0].o || 1;
    const last = candles[candles.length - 1].c;
    const change = ((last - first) / first) * 100;
    const activeChange = active.c - active.o;
    const activeRange = active.h - active.l;
    const volume = candles.reduce((acc, candle) => acc + candle.v, 0);
    return {
      active,
      last,
      change,
      activeChange,
      activeRange,
      high: Math.max(...candles.map((c) => c.h)),
      low: Math.min(...candles.map((c) => c.l)),
      volume,
    };
  }, [candles, hover]);

  const activeTime = stats?.active ? new Date(stats.active.t) : null;

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm min-w-0">
            <span className="font-semibold truncate">{pairLabel || "Chart"}</span>
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              LIVE
            </span>
          </div>
          {stats && (
            <div className="text-right num leading-tight">
              <div className={stats.change >= 0 ? "text-positive text-xl font-semibold" : "text-negative text-xl font-semibold"}>
                {fmtUsd(stats.last, { digits: stats.last < 1 ? 6 : 2 })}
              </div>
              <div className={stats.change >= 0 ? "text-positive text-xs" : "text-negative text-xs"}>
                {stats.change >= 0 ? "+" : ""}{fmtPct(stats.change)}
              </div>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-4 overflow-x-auto text-sm text-muted-foreground">
          <span>Time</span>
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              size="sm"
              variant="ghost"
              className={`h-7 shrink-0 px-0 text-sm hover:bg-transparent ${tf.label === preset.label ? "text-foreground font-semibold" : "text-muted-foreground"}`}
              onClick={() => setTf(preset)}
            >
              {preset.label}
            </Button>
          ))}
          <span>Depth</span>
        </div>
      </div>

      <div className="border-b border-border px-3 py-2 text-[11px] text-muted-foreground num">
        {stats ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <span className={stats.change >= 0 ? "text-positive" : "text-negative"}>{fmtUsd(stats.last, { digits: stats.last < 1 ? 6 : 2 })}</span>
            <span>H {fmtUsd(stats.active.h, { digits: 6 })}</span>
            <span>L {fmtUsd(stats.active.l, { digits: 6 })}</span>
            <span>Vol {fmtUsd(stats.volume, { compact: true })}</span>
            <span>{quoteSymbol || "USD"}</span>
          </div>
        ) : null}
      </div>

      <div className="relative h-[360px]">
        <div ref={containerRef} className="h-full w-full" />
        {stats && pairLabel && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-5xl font-semibold text-muted-foreground/10 tracking-tight">
            {pairLabel}
          </div>
        )}
        {stats && hover && crosshairPoint ? (
          <div
            className="pointer-events-none absolute z-10 rounded-md bg-secondary/90 px-2.5 py-2 text-xs num text-foreground shadow-card backdrop-blur"
            style={{ left: Math.min(crosshairPoint.x + 12, 210), top: Math.max(8, crosshairPoint.y - 78) }}
          >
            <div className="grid grid-cols-[70px_1fr] gap-x-3 gap-y-1">
              <span>Time</span><span>{activeTime?.toLocaleString()}</span>
              <span>Open</span><span>{fmtUsd(stats.active.o, { digits: 6 })}</span>
              <span>High</span><span>{fmtUsd(stats.active.h, { digits: 6 })}</span>
              <span>Low</span><span>{fmtUsd(stats.active.l, { digits: 6 })}</span>
              <span>Close</span><span>{fmtUsd(stats.active.c, { digits: 6 })}</span>
              <span>Change</span><span className={stats.activeChange >= 0 ? "text-positive" : "text-negative"}>{fmtUsd(stats.activeChange, { digits: 6 })} ({fmtPct((stats.activeChange / (stats.active.o || 1)) * 100)})</span>
              <span>Range</span><span>{fmtUsd(stats.activeRange, { digits: 6 })}</span>
              <span>Volume</span><span>{fmtUsd(stats.active.v, { compact: true })}</span>
            </div>
          </div>
        ) : null}
        {!candles ? (
          <div className="absolute inset-0">
            <Skeleton className="h-full w-full" />
          </div>
        ) : candles.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground bg-card">
            No live OHLCV available for this pool yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
