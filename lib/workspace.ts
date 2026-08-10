/**
 * Workspace model, shared by the edge proxy and the client.
 *
 * A workspace is either the user's personal money or one business they belong
 * to. There is exactly one app and one host — the *active workspace*, not a URL
 * prefix, decides whether a screen renders its personal or business
 * arrangement. That is why every product route is top-level (`/requests`, not
 * `/organization/<id>/invoices`) and why the active id travels in a cookie: the
 * server render has to agree with the client on which workspace is showing.
 *
 * Keep this file free of axios/React imports — proxy.ts runs on the edge.
 */

export type WorkspaceKind = "personal" | "business";

export type Workspace = {
  id: string;
  name: string;
  kind: WorkspaceKind;
  /** 1–2 letters for the avatar chip. */
  initials: string;
  /** Accent hex, e.g. "#22D3EE". */
  color: string;
  /**
   * Org membership role ("OWNER" | "ADMIN" | "MEMBER") for a business
   * workspace.
   *
   * `null` for the personal workspace — it is synthetic, has no `GroupUser`
   * row, and so genuinely has no role. Null means "no org role", never
   * "role unknown, assume owner": every permission check must treat it as
   * *not* an admin of a business workspace (see isWorkspaceAdmin).
   */
  role: string | null;
};

/**
 * The personal workspace is synthetic — it is not a Group row, so it has a
 * fixed id rather than a cuid. `GET /api/workspaces` returns it first and it
 * always exists, even for a brand-new account.
 */
export const PERSONAL_WORKSPACE_ID = "personal";

/** Design cap on business workspaces per account (switcher shows "N / 10"). */
export const BUSINESS_WORKSPACE_CAP = 10;

/** Non-httpOnly on purpose: the client sets it, the server render reads it. */
export const WORKSPACE_COOKIE = "splito_workspace";

/**
 * The client-side fallback for personal, used before `GET /api/workspaces`
 * resolves and for anonymous visitors. Every field must match what
 * `personalWorkspaceCard()` returns on the backend (initials "PE", role null)
 * — otherwise the chip visibly changes when the query lands.
 */
export const PERSONAL_WORKSPACE: Workspace = {
  id: PERSONAL_WORKSPACE_ID,
  name: "Personal",
  kind: "personal",
  initials: "PE",
  color: "#22D3EE",
  role: null,
};

export function isPersonalWorkspace(id: string | null | undefined): boolean {
  return !id || id === PERSONAL_WORKSPACE_ID;
}

/**
 * Whether the user administers this workspace.
 *
 * Personal has no role, so it is never "admin of a business workspace" — the
 * personal screens gate on `kind === "personal"`, not on this. OWNER counts
 * as admin here too — the backend gates approve/decline/mark-paid/clear to
 * OWNER or ADMIN (owner.controller.ts et al.), never ADMIN alone, so a check
 * that misses OWNER would silently strip the owner of their own admin
 * actions.
 */
export function isWorkspaceAdmin(workspace: {
  kind: WorkspaceKind;
  role: string | null;
}): boolean {
  return workspace.kind === "business" && (workspace.role === "ADMIN" || workspace.role === "OWNER");
}

/**
 * Where each retired `/organization/*` path now lives. Business screens moved
 * to the top level and lost their `[organizationId]` segment — the id becomes
 * the active-workspace cookie instead (see resolveOrganizationRedirect).
 *
 * `/organization/create` and `/organization/organizations` have no successor
 * route: creating and picking a workspace is the sidebar switcher now, and the
 * switcher is on every screen, so they land on the dashboard.
 */
const ORGANIZATION_TAB_REDIRECTS: Record<string, string> = {
  invoices: "/requests",
  expenses: "/requests",
  finances: "/treasury",
  streams: "/treasury",
  contracts: "/members",
  members: "/members",
  roles: "/members",
  settings: "/settings",
  activity: "/",
  analytics: "/",
};

/**
 * Maps a legacy `/organization/...` pathname to its replacement.
 *
 * Returns the new pathname plus the organization id to adopt as the active
 * workspace, so following an old bookmark lands on the right workspace rather
 * than whichever one the cookie last held. Returns null for paths that are not
 * under `/organization`.
 */
export function resolveOrganizationRedirect(
  pathname: string
): { pathname: string; workspaceId: string | null } | null {
  if (pathname !== "/organization" && !pathname.startsWith("/organization/")) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean).slice(1); // drop "organization"

  // /organization
  if (segments.length === 0) return { pathname: "/", workspaceId: null };

  const [first, second] = segments;

  // /organization/create, /organization/organizations[/<id>]
  if (first === "create" || first === "organizations") {
    return { pathname: "/", workspaceId: null };
  }

  // /organization/members, /organization/settings, /organization/roles[/<id>]
  if (first in ORGANIZATION_TAB_REDIRECTS) {
    return {
      pathname: ORGANIZATION_TAB_REDIRECTS[first],
      // /organization/roles/<organizationId> is the one tab-first path that
      // carries the id in the *second* segment.
      workspaceId: second ?? null,
    };
  }

  // /organization/<organizationId>[/<tab>]
  return {
    pathname: (second && ORGANIZATION_TAB_REDIRECTS[second]) ?? "/",
    workspaceId: first,
  };
}
