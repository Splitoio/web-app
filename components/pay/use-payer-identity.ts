"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth";

/**
 * Who is looking at /pay/[token] — for the only two things the public payer
 * flow is allowed to personalise: the header line ("Paying as <name>") and
 * which wallet to SUGGEST.
 *
 * Everything in here FAILS OPEN, by design. /pay is the no-account flow
 * (.plans/2026-08-06-request-money.md "NO AUTH, EVER"): an anonymous visitor —
 * or a signed-in one whose lookup 401s, 500s, or never answers — must get
 * exactly the guest page, "Paying as guest" plus the plain connect buttons.
 * Nothing on this page is ever gated, blocked, or spinnered on the answer, and
 * neither lookup here can surface an error to the payer.
 *
 * Three deliberate choices:
 *
 * 1. The page has to ask for itself. components/AuthProvider.tsx sets
 *    `skipFetch` for every public route except "/", so on /pay it never fires
 *    GET /users/me — which means useAuthStore().user is null and
 *    useSessionStatus() reports "anonymous" here for EVERYONE, signed in or
 *    not. Reading either of those would have made this feature silently dead.
 *
 * 2. The wallet lookup goes to the AUTHENTICATED endpoint
 *    `GET /api/multichain/accounts` (backend/src/routes/multichain.routes.ts,
 *    the same one the settings Wallets tab uses), never to the public request
 *    router. That router is unauthenticated on purpose and says so in its own
 *    header — "No getSession anywhere on this router" — and teaching it to read
 *    a session is what would quietly turn the stranger's pay screen into an
 *    account-aware one. The payment itself still submits through the public
 *    route, completely unchanged.
 *
 * 3. It does NOT call `getUserWallets()` from features/wallets/api/client.ts,
 *    even though that helper hits this exact endpoint: it fires a
 *    `toast.error("Failed to fetch wallet accounts")` on every failure, and a
 *    red toast on a payment page is precisely the payer-visible regression this
 *    must never introduce. Same endpoint, silent client.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** The subset of a ChainAccount row this page needs. */
interface PayerWallet {
  chainId: string;
  address: string;
  isDefault: boolean;
}

/** Resolves to `[]` for every failure mode — 401, 5xx, network, bad JSON. */
async function fetchPayerWallets(): Promise<PayerWallet[]> {
  try {
    const response = await fetch(`${API_URL}/api/multichain/accounts`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    if (!response.ok) return [];
    const payload = await response.json();
    const accounts = (payload as { accounts?: unknown } | null)?.accounts;
    return Array.isArray(accounts) ? (accounts as PayerWallet[]) : [];
  } catch {
    return [];
  }
}

export interface PayerIdentity {
  /** Display name of the signed-in visitor. Null for a guest — render "guest". */
  name: string | null;
  /** Their saved address on `chain`, when one is unambiguous. Null otherwise. */
  savedAddress: string | null;
}

/**
 * @param chain the request's destination chain, or null while it loads.
 */
export function usePayerIdentity(chain: string | null): PayerIdentity {
  // better-auth's own hook, the one lib/auth.ts exports for this. It answers
  // 200-with-null for an anonymous visitor rather than 401, so the guest path
  // produces no error state anywhere.
  const { data: session } = useSession();
  const user = session?.user ?? null;

  const { data: wallets } = useQuery({
    // Keyed by user so signing out (or in, as someone else) cannot serve the
    // previous visitor's addresses from cache.
    queryKey: ["pay", "payer-wallets", user?.id ?? null],
    queryFn: fetchPayerWallets,
    // A guest must never generate this request at all.
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const savedAddress = useMemo(() => {
    if (!chain || !wallets?.length) return null;
    const onChain = wallets.filter(
      (w) => typeof w?.address === "string" && w.address && w.chainId === chain
    );
    if (!onChain.length) return null;
    // The default for this chain wins. Failing that, a single wallet on the
    // chain is unambiguous enough to suggest. Two non-default wallets IS a
    // real choice, so suggest nothing and let them pick — and never write a
    // default back to make the ambiguity go away.
    const preferred =
      onChain.find((w) => w.isDefault) ?? (onChain.length === 1 ? onChain[0] : null);
    return preferred?.address ?? null;
  }, [wallets, chain]);

  const name =
    typeof user?.name === "string" && user.name.trim() ? user.name.trim() : null;

  return { name, savedAddress };
}
