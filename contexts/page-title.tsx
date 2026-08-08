"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type PageTitleOverride = { title: string; subtitle?: string } | null;

type PageTitleContextValue = {
  override: PageTitleOverride;
  setOverride: (v: PageTitleOverride) => void;
};

const PageTitleContext = createContext<PageTitleContextValue | null>(null);

/** Wraps the authenticated shell (see components/providers.tsx) — one instance for the whole app. */
export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<PageTitleOverride>(null);
  const value = useMemo(() => ({ override, setOverride }), [override]);
  return <PageTitleContext.Provider value={value}>{children}</PageTitleContext.Provider>;
}

function useContextOrThrow() {
  const ctx = useContext(PageTitleContext);
  if (!ctx) throw new Error("usePageTitle must be used within PageTitleProvider (see app/client-layout.tsx)");
  return ctx;
}

/**
 * Override the topbar's title/subtitle with this screen's own — a group's
 * name, a request's title. `lib/shell-nav.ts`'s `pageMetaFor()` only knows
 * static routes; a dynamic detail screen (`/groups/[id]`, `/requests/[id]`)
 * calls this once real data is in hand, e.g.:
 *
 *   usePageTitle(group?.name, `${memberCount} member${memberCount === 1 ? "" : "s"}`);
 *
 * Pass `undefined`/`null` while data is still loading — the topbar keeps
 * showing the static section title until a real title arrives. The override
 * is cleared automatically on unmount (route change), so leaving the screen
 * falls back to `pageMetaFor()` again.
 */
export function usePageTitle(title: string | null | undefined, subtitle?: string) {
  const { setOverride } = useContextOrThrow();

  useEffect(() => {
    if (!title) return;
    setOverride({ title, subtitle });
    return () => setOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle]);
}

/** Internal — read by <Topbar/> only. */
export function usePageTitleOverride(): PageTitleOverride {
  return useContextOrThrow().override;
}
