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

export function CandleChart({ pool, quoteSymbol }: { pool: string; quoteSymbol?: string }) {
  const [tf, setTf] = useState<Preset>(PRESETS[1]);
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [hover, setHover] = useState<Candle | null>(null);
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
      height: 390,
      layout: {
        background: { type: ColorType.Solid, color: cssHsl("--card", "#121318") },
        textColor: cssHsl("--muted-foreground", "#8a8f98"),
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: cssHsl("--border", "#252932") },
        horzLines: { color: cssHsl("--border", "#252932") },
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
      borderVisible: false,
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
      scaleMargins: { top: 0.08, bottom: 0.28 },
    });
    chart.priceScale("").applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });

    chart.subscribeCrosshairMove((param) => {
      const time = typeof param.time === "number" ? param.time * 1000 : null;
      if (!time) {
        setHover(null);
        return;
      }
      const match = candlesRef.current.find((c) => Math.floor(c.t / 1000) === Math.floor(time / 1000)) || null;
      setHover(match);
    });

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height: 390 });
      chart.timeScale().fitContent();
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
      chartRef.current?.timeScale().fitContent();
    }
  }, [candles]);

  const stats = useMemo(() => {
    if (!candles?.length) return null;
    const active = hover || candles[candles.length - 1];
    const first = candles[0].o || 1;
    const last = candles[candles.length - 1].c;
    const change = ((last - first) / first) * 100;
    const volume = candles.reduce((acc, candle) => acc + candle.v, 0);
    return {
      active,
      last,
      change,
      high: Math.max(...candles.map((c) => c.h)),
      low: Math.min(...candles.map((c) => c.l)),
      volume,
    };
  }, [candles, hover]);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-4 min-w-0">
          <div className="text-sm font-medium">Chart</div>
          <div className="hidden md:flex items-center gap-2 text-xs num">
            {stats && (
              <>
                <span className={stats.change >= 0 ? "text-positive" : "text-negative"}>
                  {fmtUsd(stats.last, { digits: stats.last < 1 ? 6 : 2 })}
                </span>
                <span>O {fmtUsd(stats.active.o, { digits: 6 })}</span>
                <span>H {fmtUsd(stats.active.h, { digits: 6 })}</span>
                <span>L {fmtUsd(stats.active.l, { digits: 6 })}</span>
                <span>C {fmtUsd(stats.active.c, { digits: 6 })}</span>
                <span className={stats.change >= 0 ? "text-positive" : "text-negative"}>
                  {stats.change >= 0 ? "+" : ""}{fmtPct(stats.change)}
                </span>
                <span>Vol {fmtUsd(stats.volume, { compact: true })}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {PRESETS.map((preset) => (
            <Button
              key={preset.id}
              size="sm"
              variant={tf.id === preset.id ? "default" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setTf(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground num md:hidden">
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

      <div className="relative h-[390px]">
        <div ref={containerRef} className="h-full w-full" />
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
