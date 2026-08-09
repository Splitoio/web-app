import { A, B, G, O, P, T } from "@/lib/splito-design";
import type { Workspace, WorkspaceKind } from "@/lib/workspace";
import { isWorkspaceAdmin } from "@/lib/workspace";

/**
 * The shell's navigation and page titles.
 *
 * Routes are top-level and workspace-scoped — the active workspace decides
 * whether `/requests` means "your requests" or "this business's requests &
 * invoices", so the same href appears in both navs with different copy.
 *
 * Splitting is deliberately absent: it is a request *type* inside Create, never
 * a nav destination. See .plans/2026-08-08-unified-workspace-dashboard.md
 * "Non-negotiable constraints".
 */

export type NavItem = {
  href: string;
  label: string;
  /** The 6px square that precedes the label. */
  dot: string;
  /** Optional count pill, e.g. pending approvals. */
  badge?: number;
};

export type NavGroup = { label: string; items: NavItem[] };

const PERSONAL_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", dot: A },
      { href: "/requests", label: "Requests", dot: G },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/groups", label: "Groups", dot: P },
      { href: "/people", label: "People", dot: O },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/settings", label: "Settings", dot: T.dim }],
  },
];

const BUSINESS_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", dot: A },
      { href: "/requests", label: "Requests & invoices", dot: G },
      { href: "/approvals", label: "Needs approval", dot: O },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/members", label: "Members", dot: B },
      { href: "/treasury", label: "Treasury", dot: P },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/settings", label: "Settings", dot: T.dim }],
  },
];

/**
 * `isAdmin` drops "Needs approval" from a business nav for a MEMBER —
 * approve/decline/mark-paid/clear are OWNER/ADMIN-only on the backend
 * (invoice.controller.ts), so a member following the link would only ever
 * land on a "not allowed" screen. Ignored for a personal workspace, which
 * has no approvals item to begin with.
 */
export function navGroupsFor(kind: WorkspaceKind, isAdmin = true): NavGroup[] {
  if (kind !== "business") return PERSONAL_NAV;
  if (isAdmin) return BUSINESS_NAV;
  return BUSINESS_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.href !== "/approvals"),
  }));
}

/** Longest-prefix match, so `/requests/<id>` still highlights Requests. */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Stable DOM id for a nav item's rendered `<Link>`, derived from its href so
 * it can never silently drift out of sync with the sidebar the way the old
 * hand-written `sidebar-org-*-link` ids did (those named routes — dashboard,
 * invoices, streams, contracts, members — from the deleted `/organization/*`
 * shell and were never updated when the nav moved to `navGroupsFor`).
 * Consumed by both `Sidebar` (sets the id) and `OnboardingTutorial` (targets
 * it), so the two can never disagree about what a step should spotlight.
 */
export function navItemId(href: string): string {
  const slug = href === "/" ? "dashboard" : href.replace(/^\//, "").replace(/\//g, "-");
  return `sidebar-nav-${slug}`;
}

export type PageMeta = { title: string; subtitle: string };

type MetaFactory = (workspace: Workspace) => PageMeta;

const PERSONAL_META: Record<string, MetaFactory> = {
  "/": () => ({ title: "Dashboard", subtitle: "Where your money stands right now" }),
  "/requests": () => ({ title: "Requests", subtitle: "Everything you've asked for" }),
  "/create": () => ({ title: "New request", subtitle: "Ask in any currency, get paid in the one you want" }),
  "/groups": () => ({ title: "Groups", subtitle: "Running tabs with the people you see often" }),
  "/people": () => ({ title: "People", subtitle: "Everyone you've requested from or paid" }),
  "/settings": () => ({ title: "Settings", subtitle: "Your account and how you get paid" }),
};

const BUSINESS_META: Record<string, MetaFactory> = {
  "/": (w) => ({ title: "Dashboard", subtitle: `Where ${w.name} stands right now` }),
  "/requests": () => ({ title: "Requests & invoices", subtitle: "Everything owed to and by this workspace" }),
  "/approvals": () => ({ title: "Needs approval", subtitle: "Waiting on you before it can be paid" }),
  "/create": () => ({ title: "New request", subtitle: "Bill a client, or pay someone out" }),
  "/members": () => ({ title: "Members", subtitle: "Who's here, and on what terms" }),
  "/treasury": () => ({ title: "Treasury", subtitle: "What's come in, and where it came from" }),
  "/settings": () => ({ title: "Settings", subtitle: "Workspace settings and defaults" }),
};

function longestMatch(table: Record<string, MetaFactory>, pathname: string): string | undefined {
  return Object.keys(table)
    .filter((href) => isNavItemActive(href, pathname))
    .sort((a, b) => b.length - a.length)[0];
}

/**
 * Title + subtitle for the topbar. Falls back to the closest parent route so a
 * detail page (`/requests/<id>`) inherits its section's heading until a screen
 * overrides it via `usePageTitle()` (contexts/page-title.tsx).
 *
 * Routes are only nav-linked from one workspace kind (`/members`/`/treasury`/
 * `/approvals` are business-only, never in `PERSONAL_META`), but they're still
 * real top-level pages reachable by direct URL regardless of which workspace
 * is currently active — nothing stops a personal-workspace user from landing
 * on `/treasury`. So a miss in the active kind's table falls back to the
 * *other* table before defaulting to "/"; only a route unknown to both tables
 * gets the dashboard title.
 */
export function pageMetaFor(pathname: string, workspace: Workspace): PageMeta {
  const primary = workspace.kind === "business" ? BUSINESS_META : PERSONAL_META;
  const secondary = workspace.kind === "business" ? PERSONAL_META : BUSINESS_META;

  const key = longestMatch(primary, pathname);
  if (key) return primary[key](workspace);

  const fallbackKey = longestMatch(secondary, pathname);
  if (fallbackKey) return secondary[fallbackKey](workspace);

  return primary["/"](workspace);
}
