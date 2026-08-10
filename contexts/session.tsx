"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * What the UI is allowed to assume about the visitor's session.
 *
 * `isAuthenticated` from stores/authStore.ts is a BOOLEAN, and a boolean cannot
 * express the difference between the three ways it can be false:
 *
 *   - nobody is signed in                        → lock the console
 *   - we are still asking GET /api/users/me      → wait, decide nothing
 *   - the ask FAILED (500, network, backend down) → say so; never claim they
 *                                                   are signed out
 *
 * Collapsing those three into `!isAuthenticated` is what made a transient
 * /users/me failure tell a signed-in user to "Sign in to see your requests" on
 * every screen, with a 5-minute staleTime and no refetch-on-focus to clear it.
 * Anything that decides between real UI and a locked/error state reads THIS,
 * never the boolean.
 */
export type SessionStatus = "anonymous" | "loading" | "authenticated" | "error";

// Defaults to "loading", never "anonymous". A consumer rendered outside the
// provider by some future refactor would otherwise silently show the locked
// "Sign in to …" state — the exact lie this module exists to prevent, and it
// would fail quietly. "loading" degrades to a spinner instead: visibly wrong
// rather than confidently wrong.
const SessionContext = createContext<SessionStatus>("loading");

export function SessionStatusProvider({
  status,
  children,
}: {
  status: SessionStatus;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={status}>{children}</SessionContext.Provider>;
}

export function useSessionStatus(): SessionStatus {
  return useContext(SessionContext);
}

/**
 * True only for a genuinely signed-out visitor — the one case where showing
 * "Sign in to …" is the truth. Loading and error are NOT locked: see the type
 * above for why that distinction is load-bearing.
 */
export function useIsLocked(): boolean {
  return useSessionStatus() === "anonymous";
}
