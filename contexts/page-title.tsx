"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

export type PageTitleOverride = { title: string; subtitle?: string } | null;

/** A screen's own action buttons, rendered by <Topbar/> next to "+ Create". */
type PageActionsRenderer = (() => ReactNode) | null;

type PageTitleContextValue = {
  override: PageTitleOverride;
  setOverride: (v: PageTitleOverride) => void;
  actions: PageActionsRenderer;
  // React's own setter type: the renderer IS a function, so publishing it has
  // to go through the updater form (`setActions(() => render)`) or useState
  // would call it instead of storing it.
  setActions: Dispatch<SetStateAction<PageActionsRenderer>>;
};

const PageTitleContext = createContext<PageTitleContextValue | null>(null);

/** Wraps the authenticated shell (see components/providers.tsx) — one instance for the whole app. */
export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<PageTitleOverride>(null);
  const [actions, setActions] = useState<PageActionsRenderer>(null);
  const value = useMemo(() => ({ override, setOverride, actions, setActions }), [override, actions]);
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

/**
 * Put this screen's own action buttons in the topbar, to the left of the bell
 * and "+ Create" — for a screen whose primary actions belong in the header row
 * rather than floating above its content (People's "Add by email" / "Invite a
 * friend").
 *
 *   usePageActions(() => <>…buttons…</>, [openAdd, openInvite]);
 *
 * `render` is a FUNCTION, and `deps` is the array that decides when it is
 * re-published: a JSX element has a new identity on every render, so publishing
 * the element itself would loop forever. List whatever the buttons close over.
 *
 * <Topbar/> only mounts at >=1025px (app/client-layout.tsx). Below that the
 * screen is responsible for rendering the same actions in its own header — see
 * app/people/page.tsx.
 */
export function usePageActions(render: () => ReactNode, deps: unknown[]) {
  const { setActions } = useContextOrThrow();

  useEffect(() => {
    setActions(() => render);
    return () => setActions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Internal — read by <Topbar/> only. */
export function usePageActionsRenderer(): PageActionsRenderer {
  return useContextOrThrow().actions;
}
