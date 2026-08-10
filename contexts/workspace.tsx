"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import Cookies from "js-cookie";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { useWorkspaces as useWorkspacesQuery } from "@/features/workspaces/hooks/use-workspaces";
import {
  BUSINESS_WORKSPACE_CAP,
  PERSONAL_WORKSPACE,
  PERSONAL_WORKSPACE_ID,
  WORKSPACE_COOKIE,
  type Workspace,
} from "@/lib/workspace";

type WorkspaceContextValue = {
  workspaces: Workspace[];
  active: Workspace;
  activeId: string;
  /** How many business workspaces the account has, and the cap ("N / 10"). */
  businessCount: number;
  businessCap: number;
  /** The server's verdict on the cap — the switcher disables "+ New" on false. */
  canCreateBusiness: boolean;
  isLoading: boolean;
  /**
   * True while `active` is a *guess*: the cookie names a workspace the list
   * has not returned yet, so the personal fallback below is standing in for a
   * business workspace we cannot describe yet.
   *
   * Anything that branches on `active.kind` must wait this out. Rendering
   * through it mounts the personal arrangement for a business account, which
   * costs a wasted `/workspaces/personal/summary` round-trip and a visible
   * flash of the wrong dashboard before the list lands.
   */
  isResolvingActive: boolean;
  setActiveWorkspace: (id: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const COOKIE_MAX_AGE_DAYS = 365;

/**
 * Holds the workspace list and which one is active.
 *
 * The active id lives in a cookie rather than localStorage on purpose: the
 * server render reads it (app/layout.tsx passes it down as `initialWorkspaceId`)
 * so the first paint already shows the right workspace and the client does not
 * have to correct it. proxy.ts writes the same cookie when it redirects a
 * legacy `/organization/<id>/…` link.
 */
export function WorkspaceProvider({
  children,
  initialWorkspaceId,
}: {
  children: React.ReactNode;
  initialWorkspaceId?: string | null;
}) {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const { data, isLoading } = useWorkspacesQuery({ enabled: isAuthenticated });

  // Cookie first (it is what the server rendered against), then the prop the
  // server read, then personal — which always exists.
  const [activeId, setActiveId] = React.useState<string>(
    () => initialWorkspaceId ?? PERSONAL_WORKSPACE_ID
  );

  React.useEffect(() => {
    const fromCookie = Cookies.get(WORKSPACE_COOKIE);
    if (fromCookie && fromCookie !== activeId) setActiveId(fromCookie);
    // Only on mount: after that the setter below is the single writer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const workspaces = useMemo(
    () => data?.workspaces ?? [PERSONAL_WORKSPACE],
    [data?.workspaces]
  );

  // A stale cookie (workspace left, deleted, or another account's) must never
  // strand the user on a workspace they cannot see — fall back to personal.
  const active = useMemo(
    () => workspaces.find((w) => w.id === activeId) ?? workspaces[0] ?? PERSONAL_WORKSPACE,
    [workspaces, activeId]
  );

  const setActiveWorkspace = useCallback(
    (id: string) => {
      setActiveId(id);
      Cookies.set(WORKSPACE_COOKIE, id, {
        expires: COOKIE_MAX_AGE_DAYS,
        path: "/",
        sameSite: "lax",
      });
      // Every list, summary and count on screen is workspace-scoped.
      queryClient.invalidateQueries();
    },
    [queryClient]
  );

  // Personal is the one id that never needs the list to be resolvable, so a
  // personal cookie is never "resolving". Any other id is unknown until the
  // fetch lands.
  const isResolvingActive =
    isLoading && activeId !== PERSONAL_WORKSPACE_ID && !workspaces.some((w) => w.id === activeId);

  const value = useMemo<WorkspaceContextValue>(() => {
    const businessCount =
      data?.businessCount ?? workspaces.filter((w) => w.kind === "business").length;
    const businessCap = data?.businessCap ?? BUSINESS_WORKSPACE_CAP;
    return {
      workspaces,
      active,
      activeId: active.id,
      businessCount,
      businessCap,
      canCreateBusiness: data?.canCreateBusiness ?? businessCount < businessCap,
      isLoading,
      isResolvingActive,
      setActiveWorkspace,
    };
  }, [
    workspaces,
    active,
    data?.businessCount,
    data?.businessCap,
    data?.canCreateBusiness,
    isLoading,
    isResolvingActive,
    setActiveWorkspace,
  ]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

function useWorkspaceContext(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspaces must be used inside <WorkspaceProvider>");
  }
  return ctx;
}

/** Every workspace the account can switch to, plus the cap counters. */
export function useWorkspaces() {
  const { workspaces, businessCount, businessCap, canCreateBusiness, isLoading } =
    useWorkspaceContext();
  return { workspaces, businessCount, businessCap, canCreateBusiness, isLoading };
}

/**
 * The workspace the app is currently showing. This — not the URL — is what
 * decides whether a screen renders its personal or business arrangement.
 *
 * On the first paint after a reload this is the personal fallback even when
 * the cookie names a business workspace — the list has not arrived yet. A
 * screen that renders a different arrangement per `kind` should pair this with
 * `useIsResolvingWorkspace()` and hold a skeleton until it returns false.
 */
export function useActiveWorkspace(): Workspace {
  return useWorkspaceContext().active;
}

/** True while `useActiveWorkspace()` is still the personal stand-in. */
export function useIsResolvingWorkspace(): boolean {
  return useWorkspaceContext().isResolvingActive;
}

/** Switches workspace and refetches everything scoped to it. */
export function useSetActiveWorkspace(): (id: string) => void {
  return useWorkspaceContext().setActiveWorkspace;
}
