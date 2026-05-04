import { Button } from "@/components/ui/button";
import { Wallet, LogOut, Copy } from "lucide-react";
import { useWallet } from "@/wallet/WalletProvider";
import { shortAddr } from "@/lib/lpAgent";
import { toast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export function ConnectWalletButton() {
  const { connected, address, connect, disconnect, connecting } = useWallet();

  if (!connected) {
    return (
      <Button
        onClick={async () => {
          try { await connect(); }
          catch (e: any) {
            toast({ title: "Couldn't connect", description: e?.message || "Install Phantom and try again.", variant: "destructive" });
          }
        }}
        disabled={connecting}
        className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
      >
        <Wallet className="h-4 w-4" />
        {connecting ? "Connecting…" : "Connect Wallet"}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="font-mono text-sm border-border bg-card">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          {shortAddr(address)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(address || ""); toast({ title: "Address copied" }); }}>
          <Copy className="h-4 w-4 mr-2" /> Copy address
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => disconnect()} className="text-destructive">
          <LogOut className="h-4 w-4 mr-2" /> Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
