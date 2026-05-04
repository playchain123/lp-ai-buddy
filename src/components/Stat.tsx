import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Stat({ label, value, delta, hint, className }: {
  label: string;
  value: ReactNode;
  delta?: { value: number; suffix?: string } | null;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 flex flex-col gap-1.5", className)}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold num tracking-tight">{value}</div>
      <div className="flex items-center gap-2 text-xs">
        {delta != null && (
          <span className={cn(
            "num font-medium",
            delta.value > 0 ? "text-positive" : delta.value < 0 ? "text-negative" : "text-muted-foreground",
          )}>
            {delta.value > 0 ? "+" : ""}{delta.value.toFixed(2)}{delta.suffix ?? "%"}
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}
