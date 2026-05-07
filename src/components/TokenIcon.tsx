import { useState } from "react";
import { tokenIconFallbacks } from "@/lib/gecko";
import { cn } from "@/lib/utils";

export function TokenIcon({ mint, symbol, size = 20, className }: {
  mint?: string; symbol?: string; size?: number; className?: string;
}) {
  const [idx, setIdx] = useState(0);
  const urls = tokenIconFallbacks(mint);
  const url = urls[idx];
  const px = `${size}px`;
  if (!url) {
    return (
      <span
        className={cn("rounded-full bg-secondary inline-flex items-center justify-center text-[9px] font-medium uppercase", className)}
        style={{ width: px, height: px }}
      >{(symbol || "?").slice(0, 2)}</span>
    );
  }
  return (
    <img
      src={url}
      alt={symbol || ""}
      style={{ width: px, height: px }}
      className={cn("rounded-full bg-secondary object-cover", className)}
      onError={() => setIdx((i) => i + 1)}
      loading="lazy"
    />
  );
}
