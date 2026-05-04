import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/wallet/WalletProvider";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { Sparkles, Wallet, Compass, MessageSquare, Zap, ArrowRight } from "lucide-react";

export default function Landing() {
  const { connected } = useWallet();
  const navigate = useNavigate();
  useEffect(() => { if (connected) navigate("/portfolio"); }, [connected, navigate]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-[0.25] pointer-events-none" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/15 blur-[120px] pointer-events-none" />

      <header className="relative z-10 h-14 px-4 sm:px-6 flex items-center justify-between border-b border-border/60">
        <div className="flex items-center gap-2 font-semibold">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          LP <span className="text-primary">Copilot</span>
        </div>
        <ConnectWalletButton />
      </header>

      <section className="relative z-10 max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Powered by LP Agent · Built for Meteora on Solana
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05] mb-5">
          Talk to your <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">LP positions</span>.
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Track your Meteora liquidity, discover top pools, and zap in or out — all driven by a natural-language AI agent on real on-chain data.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button size="lg" asChild className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6 text-base">
            <Link to="/portfolio"><Wallet className="h-4 w-4" /> Open Dashboard <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="h-12 px-6 text-base">
            <Link to="/chat"><Sparkles className="h-4 w-4" /> Try the AI Copilot</Link>
          </Button>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-16 text-left">
          {[
            { icon: Wallet, t: "Portfolio Tracker", d: "Real-time PnL, fees, in-range %, and per-position health for every Meteora pool you LP." },
            { icon: Compass, t: "Pool Discovery", d: "Browse and filter every Meteora DLMM and DAMM v2 pool by TVL, volume, and APR." },
            { icon: Zap, t: "1-Click Zap", d: "Zap in from SOL with auto-swap, or zap out to SOL — signed in your Phantom wallet." },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border border-border bg-card p-5">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <f.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="font-semibold mb-1">{f.t}</div>
              <p className="text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
