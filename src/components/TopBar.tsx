import { useNavigate } from "react-router-dom";
import { Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ConnectWalletButton } from "./ConnectWalletButton";
import { useState } from "react";

export function TopBar() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    // Address heuristic: 32-44 base58 chars
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) {
      navigate(`/portfolio?wallet=${v}`);
    } else {
      navigate(`/pools?search=${encodeURIComponent(v)}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/80 backdrop-blur flex items-center px-4 gap-3">
      <div className="md:hidden flex items-center gap-2 mr-2">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
      </div>
      <div className="hidden md:flex items-center gap-2 font-semibold tracking-tight">
        LP <span className="text-primary">Copilot</span>
        <span className="text-xs text-muted-foreground font-normal hidden lg:inline ml-2">on Solana · Meteora</span>
      </div>
      <form onSubmit={onSubmit} className="flex-1 max-w-xl mx-auto relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search wallet address or token (e.g. SOL/USDC)…"
          className="pl-9 h-9 bg-card border-border focus-visible:ring-1 focus-visible:ring-primary"
        />
      </form>
      <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md border border-border bg-card text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        Solana Mainnet
      </div>
      <ConnectWalletButton />
    </header>
  );
}
