import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";

// Bybit-style animated number: interpolates between values and flashes green/red on change.
export function AnimatedNumber({
  value, format, className, showArrow = false, durationMs = 600,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  showArrow?: boolean;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prev = useRef(value);

  useEffect(() => {
    if (value === prev.current) return;
    const dir = value > prev.current ? "up" : "down";
    setFlash(dir);
    const start = prev.current;
    const startedAt = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplay(start + (value - start) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
      else { setDisplay(value); prev.current = value; }
    };
    raf = requestAnimationFrame(tick);
    const flashTimer = setTimeout(() => setFlash(null), 1100);
    return () => { cancelAnimationFrame(raf); clearTimeout(flashTimer); };
  }, [value, durationMs]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1 rounded num transition-colors",
        flash === "up" && "text-[hsl(var(--success))] pulse-up",
        flash === "down" && "text-[hsl(var(--destructive))] pulse-down",
        className,
      )}
    >
      {showArrow && flash === "up" && <TrendingUp className="h-3 w-3" />}
      {showArrow && flash === "down" && <TrendingDown className="h-3 w-3" />}
      {format(display)}
    </span>
  );
}
