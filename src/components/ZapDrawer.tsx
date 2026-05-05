import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/wallet/WalletProvider";
import { zapFn, fmtUsd, pick, shortAddr, poolAddress, poolLabel, extractTxBundle } from "@/lib/lpAgent";
import { toast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, Zap } from "lucide-react";
import { Connection } from "@solana/web3.js";

export type ZapInIntent = {
  kind: "in";
  pool: any; // raw pool object from LP Agent
};
export type ZapOutIntent = {
  kind: "out";
  position: any;
};
export type ZapIntent = ZapInIntent | ZapOutIntent;

export function ZapDrawer({ intent, onClose }: { intent: ZapIntent | null; onClose: () => void }) {
  const open = !!intent;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-card border-l border-border">
        {intent?.kind === "in" && <ZapInPanel pool={intent.pool} onDone={onClose} />}
        {intent?.kind === "out" && <ZapOutPanel position={intent.position} onDone={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function ZapInPanel({ pool, onDone }: { pool: any; onDone: () => void }) {
  const { connected, address, connect, signAndSendBase64Txs, rpcEndpoint } = useWallet();
  const [amount, setAmount] = useState("0.1");
  const [strategy, setStrategy] = useState<"Spot" | "Curve" | "BidAsk">("Spot");
  const [slippageBps, setSlippageBps] = useState(100);
  const [building, setBuilding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);

  const poolId = poolAddress(pool);

  const execute = async () => {
    if (!connected || !address) { await connect(); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast({ title: "Enter an amount", variant: "destructive" }); return; }
    try {
      setBuilding(true);
      const built = await zapFn("zapInBuild", {
        poolId, owner: address, amountSol: amt, strategy, slippageBps,
      });
      setBuilding(false);

      const bundle = extractTxBundle(built);
      const txs: string[] = bundle.txs;
      if (!txs.length) throw new Error("No transactions returned by LP Agent");

      setSubmitting(true);
      const signed = await signAndSendBase64Txs(txs);
      const swapSigned = signed.slice(0, bundle.swap.length);
      const addSigned = signed.slice(bundle.swap.length, bundle.swap.length + bundle.add.length);

      // Try LP Agent's landing endpoint (Jito), fallback to direct RPC if it fails.
      try {
        const land = await zapFn("zapInLand", {
          lastValidBlockHeight: bundle.lastValidBlockHeight,
          swapTxsWithJito: swapSigned,
          addLiquidityTxsWithJito: addSigned.length ? addSigned : signed,
          meta: bundle.d?.meta,
        });
        const sig = land?.signature || land?.signatures?.[0] || land?.txSignature;
        if (sig) { setTxSig(sig); toast({ title: "Zap landed", description: shortAddr(sig, 6) }); return; }
      } catch (e) {
        console.warn("landing failed, falling back to RPC", e);
      }
      const conn = new Connection(rpcEndpoint, "confirmed");
      let sig = "";
      for (const s of signed) {
        const buf = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
        sig = await conn.sendRawTransaction(buf, { skipPreflight: false });
      }
      setTxSig(sig);
      toast({ title: "Submitted", description: shortAddr(sig, 6) });
    } catch (e: any) {
      toast({ title: "Zap failed", description: e?.message?.slice(0, 200) || "Unknown error", variant: "destructive" });
    } finally {
      setBuilding(false);
      setSubmitting(false);
    }
  };

  const busy = building || submitting;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" /> Zap In
        </SheetTitle>
        <SheetDescription>Open a new LP position on Meteora.</SheetDescription>
      </SheetHeader>
      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-1">
          <div className="text-xs text-muted-foreground">Pool</div>
          <div className="font-medium">{poolLabel(pool)}</div>
          <div className="text-xs text-muted-foreground font-mono">{shortAddr(poolId, 6)}</div>
          <div className="flex flex-wrap gap-2 text-xs pt-1">
            <Badge variant="secondary">TVL {fmtUsd(pick(pool, ["tvl", "tvlUsd"]), { compact: true })}</Badge>
            <Badge variant="secondary">Vol 24h {fmtUsd(pick(pool, ["vol_24h", "volume24h"]), { compact: true })}</Badge>
            <Badge variant="secondary">APR {Number(pick(pool, ["apr", "apr_24h"], 0)).toFixed(1)}%</Badge>
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase text-muted-foreground">Amount (SOL)</Label>
          <Input
            type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="mt-1 num text-lg h-12 bg-background"
          />
          <div className="flex gap-1.5 mt-2">
            {["0.1", "0.5", "1", "5"].map((v) => (
              <Button key={v} variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAmount(v)}>{v} SOL</Button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase text-muted-foreground">Strategy</Label>
          <Tabs value={strategy} onValueChange={(v) => setStrategy(v as any)} className="mt-1">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="Spot">Spot</TabsTrigger>
              <TabsTrigger value="Curve">Curve</TabsTrigger>
              <TabsTrigger value="BidAsk">Bid-Ask</TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground mt-2">
            {strategy === "Spot" && "Even distribution across the range. Balanced risk."}
            {strategy === "Curve" && "Concentrated near current price. Higher fees, higher IL risk."}
            {strategy === "BidAsk" && "Concentrated at edges. For ranging markets."}
          </p>
        </div>

        <div>
          <Label className="text-xs uppercase text-muted-foreground">Slippage</Label>
          <div className="flex gap-1.5 mt-1">
            {[50, 100, 300, 500].map((v) => (
              <Button key={v} variant={slippageBps === v ? "default" : "outline"} size="sm" className="h-8" onClick={() => setSlippageBps(v)}>
                {(v / 100).toFixed(2)}%
              </Button>
            ))}
          </div>
        </div>

        {txSig && (
          <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noreferrer"
             className="flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline">
            View on Solscan <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        <Button onClick={execute} disabled={busy} className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 text-base font-semibold">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {!connected ? "Connect Wallet" : building ? "Building tx…" : submitting ? "Sign & sending…" : "Sign & Execute Zap In"}
        </Button>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Powered by LP Agent. Transactions are built server-side and signed locally in your wallet.
        </p>
      </div>
    </>
  );
}

function ZapOutPanel({ position, onDone }: { position: any; onDone: () => void }) {
  const { connected, address, connect, signAndSendBase64Txs, rpcEndpoint } = useWallet();
  const [bps, setBps] = useState(10000);
  const [output, setOutput] = useState<"allBaseToken" | "both" | "allToken0" | "allToken1">("allBaseToken");
  const [busy, setBusy] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const positionId = pick(position, ["id", "positionId", "address"]);
  const pair = pick(position, ["pair", "name"]) || `${pick(position, ["token0.symbol"], "?")}/${pick(position, ["token1.symbol"], "?")}`;
  const value = pick(position, ["currentValue", "valueUsd", "value"]);

  const execute = async () => {
    if (!connected || !address) { await connect(); return; }
    try {
      setBusy(true);
      const built = await zapFn("zapOutBuild", { positionId, owner: address, bps, output, slippageBps: 100 });
      const bundle = extractTxBundle(built);
      const txs: string[] = bundle.txs;
      if (!txs.length) throw new Error("No transactions returned");
      const signed = await signAndSendBase64Txs(txs);
      const swapSigned = signed.slice(0, bundle.swap.length);
      const closeSigned = signed.slice(bundle.swap.length, bundle.swap.length + bundle.close.length);
      try {
        const land = await zapFn("zapOutLand", {
          lastValidBlockHeight: bundle.lastValidBlockHeight,
          swapTxsWithJito: swapSigned,
          closeTxsWithJito: closeSigned.length ? closeSigned : signed,
        });
        const sig = land?.signature || land?.signatures?.[0];
        if (sig) { setTxSig(sig); toast({ title: "Zap out landed", description: shortAddr(sig, 6) }); return; }
      } catch {}
      const conn = new Connection(rpcEndpoint, "confirmed");
      let sig = "";
      for (const s of signed) {
        const buf = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
        sig = await conn.sendRawTransaction(buf, { skipPreflight: false });
      }
      setTxSig(sig);
      toast({ title: "Submitted", description: shortAddr(sig, 6) });
    } catch (e: any) {
      toast({ title: "Zap out failed", description: e?.message?.slice(0, 200), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-warning" /> Zap Out</SheetTitle>
        <SheetDescription>Withdraw liquidity from this position.</SheetDescription>
      </SheetHeader>
      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-border bg-secondary/40 p-3">
          <div className="text-xs text-muted-foreground">Position</div>
          <div className="font-medium">{pair}</div>
          <div className="text-xs text-muted-foreground">Current value: <span className="num">{fmtUsd(value)}</span></div>
        </div>

        <div>
          <Label className="text-xs uppercase text-muted-foreground">Withdraw</Label>
          <div className="flex gap-1.5 mt-1">
            {[2500, 5000, 7500, 10000].map((v) => (
              <Button key={v} variant={bps === v ? "default" : "outline"} size="sm" className="h-8 flex-1" onClick={() => setBps(v)}>
                {v / 100}%
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase text-muted-foreground">Receive as</Label>
          <Tabs value={output} onValueChange={(v) => setOutput(v as any)} className="mt-1">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="allBaseToken">SOL</TabsTrigger>
              <TabsTrigger value="both">Both tokens</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {txSig && (
          <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary">
            View on Solscan <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        <Button onClick={execute} disabled={busy} className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 text-base font-semibold">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {!connected ? "Connect Wallet" : busy ? "Processing…" : `Sign & Withdraw ${bps / 100}%`}
        </Button>
      </div>
    </>
  );
}
