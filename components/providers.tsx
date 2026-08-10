"use client";

import { useEffect, useState } from "react";
import { queryClient } from "@/api-helpers/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./AuthProvider";
import { PostHogProvider } from "./PostHogProvider";
import { WorkspaceProvider } from "@/contexts/workspace";
import { PageTitleProvider } from "@/contexts/page-title";

export function Providers({
  children,
  initialWorkspaceId,
  hasSession = false,
}: {
  children: React.ReactNode;
  /** Read from the workspace cookie during the server render (app/layout.tsx). */
  initialWorkspaceId?: string | null;
  /** Session-cookie presence, also read during the server render. */
  hasSession?: boolean;
}) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated) {
    return null;
  }

  return (
    <PostHogProvider>
      <QueryClientProvider client={queryClient}>
        {/*
          No global AptosWalletAdapterProvider here — it used to wrap every
          route, and constructing its WalletCore on mount fires 4 mainnet RPC
          calls (api.mainnet.aptoslabs.com) on EVERY page load, including
          signed-out pages with no wallet connected. `useWallet()` from
          hooks/useWallet.ts reads Aptos state via `@aptos-labs/wallet-adapter-react`'s
          own `useWallet()`, whose context has a `{ connected: false }`
          default when no provider is mounted — so it degrades gracefully
          here. Components that need real Aptos wallet connect/sign
          (WalletSelector, AddWalletModal) mount their own scoped provider
          locally, so the client only spins up on first actual use.
        */}
        <AuthProvider hasSession={hasSession}>
          <WorkspaceProvider initialWorkspaceId={initialWorkspaceId}>
            <PageTitleProvider>{children}</PageTitleProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </QueryClientProvider>
    </PostHogProvider>
  );
}
