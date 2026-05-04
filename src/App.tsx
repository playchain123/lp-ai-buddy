import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/wallet/WalletProvider";
import { AppLayout } from "@/components/AppLayout";
import Landing from "./pages/Landing";
import Portfolio from "./pages/Portfolio";
import Pools from "./pages/Pools";
import PoolDetail from "./pages/PoolDetail";
import Chat from "./pages/Chat";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WalletProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/portfolio" element={<AppLayout><Portfolio /></AppLayout>} />
            <Route path="/pools" element={<AppLayout><Pools /></AppLayout>} />
            <Route path="/pools/:id" element={<AppLayout><PoolDetail /></AppLayout>} />
            <Route path="/chat" element={<AppLayout><Chat /></AppLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </WalletProvider>
  </QueryClientProvider>
);

export default App;
