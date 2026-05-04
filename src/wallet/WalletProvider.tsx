import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import type { PublicKey, VersionedTransaction, Transaction } from "@solana/web3.js";

type Ctx = {
  connected: boolean;
  publicKey: PublicKey | null;
  address: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signAndSendBase64Txs: (b64s: string[]) => Promise<string[]>; // returns base64 of signed txs
  rpcEndpoint: string;
};

const WalletCtx = createContext<Ctx | null>(null);

const RPC = "https://api.mainnet-beta.solana.com";

let adapter: PhantomWalletAdapter | null = null;
function getAdapter() {
  if (!adapter) adapter = new PhantomWalletAdapter({ network: WalletAdapterNetwork.Mainnet });
  return adapter;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const a = getAdapter();
    const onConnect = () => setPublicKey(a.publicKey);
    const onDisconnect = () => setPublicKey(null);
    a.on("connect", onConnect);
    a.on("disconnect", onDisconnect);
    // try silent reconnect
    a.connect().catch(() => {});
    return () => {
      a.off("connect", onConnect);
      a.off("disconnect", onDisconnect);
    };
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const a = getAdapter();
      if (!a.connected) await a.connect();
      setPublicKey(a.publicKey);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await getAdapter().disconnect();
    setPublicKey(null);
  }, []);

  const signAndSendBase64Txs = useCallback(async (b64s: string[]): Promise<string[]> => {
    const a = getAdapter();
    if (!a.connected || !a.publicKey) throw new Error("Wallet not connected");
    const { VersionedTransaction, Transaction } = await import("@solana/web3.js");
    const signed: string[] = [];
    for (const b of b64s) {
      const buf = Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
      let tx: VersionedTransaction | Transaction;
      try {
        tx = VersionedTransaction.deserialize(buf);
      } catch {
        tx = Transaction.from(buf);
      }
      const s = await (a as any).signTransaction(tx);
      const ser: Uint8Array = s.serialize();
      let str = "";
      for (let i = 0; i < ser.length; i++) str += String.fromCharCode(ser[i]);
      signed.push(btoa(str));
    }
    return signed;
  }, []);

  const value = useMemo<Ctx>(() => ({
    connected: !!publicKey,
    publicKey,
    address: publicKey?.toBase58() ?? null,
    connecting,
    connect,
    disconnect,
    signAndSendBase64Txs,
    rpcEndpoint: RPC,
  }), [publicKey, connecting, connect, disconnect, signAndSendBase64Txs]);

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

export function useWallet() {
  const c = useContext(WalletCtx);
  if (!c) throw new Error("useWallet must be used within WalletProvider");
  return c;
}
