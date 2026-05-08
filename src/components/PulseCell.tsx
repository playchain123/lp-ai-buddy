import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { fmtPct } from "@/lib/lpAgent";

export function PulseCell({ value, className }: { value: number; className?: string }) {
  const prev = useRef<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    const previous = prev.current;
    if (previous != null && value !== previous) {
      setFlash(value > prev.current ? "up" : "down");
      const id = setTimeout(() => setFlash(null), 1200);
      prev.current = value;
      return () => clearTimeout(id);
    }
    prev.current = value;
  }, [value]);
  const positive = value > 0;
  const negative = value < 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded num font-medium",
        positive && "text-[hsl(var(--success))]",
        negative && "text-[hsl(var(--destructive))]",
        flash === "up" && "pulse-up",
        flash === "down" && "pulse-down",
        className,
      )}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : negative ? <TrendingDown className="h-3 w-3" /> : null}
      {fmtPct(value)}
    </span>
  );
}
