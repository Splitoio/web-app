import { apiClient } from "@/api-helpers/client";
import { z } from "zod";
import {
  BUSINESS_WORKSPACE_CAP,
  PERSONAL_WORKSPACE,
  type Workspace,
} from "@/lib/workspace";

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["personal", "business"]),
  initials: z.string(),
  color: z.string(),
  // The synthetic personal workspace has no GroupUser row, so the backend
  // reports role: null for it (workspace.service.ts personalWorkspaceCard).
  // Requiring a string here failed validation on EVERY screen.
  role: z.string().nullable(),
});

/**
 * `GET /api/workspaces` (backend PR #29, A4) returns the synthetic personal
 * workspace plus every BUSINESS group the user belongs to, and reports how many
 * business workspaces the account has against the cap so the switcher can show
 * "N / 10". The count is authoritative from the server — the cap is enforced
 * there too, not here.
 */
const WorkspacesResponseSchema = z.object({
  workspaces: z.array(WorkspaceSchema),
  businessCount: z.number().int().nonnegative(),
  businessCap: z.number().int().positive(),
  // The server's own verdict on whether another business workspace may be
  // created. Optional so an older backend does not fail validation; the
  // count-vs-cap comparison is the fallback.
  canCreateBusiness: z.boolean().optional(),
});

/**
 * What `getWorkspaces` hands the app — not the raw payload. `canCreateBusiness`
 * is always resolved here so callers never have to redo the cap arithmetic.
 */
export type WorkspacesResponse = {
  workspaces: Workspace[];
  businessCount: number;
  businessCap: number;
  canCreateBusiness: boolean;
};

/** Personal is first and always present, even if the server omitted it. */
function withPersonal(workspaces: Workspace[]): Workspace[] {
  return workspaces.some((w) => w.kind === "personal")
    ? workspaces
    : [PERSONAL_WORKSPACE, ...workspaces];
}

export async function getWorkspaces(): Promise<WorkspacesResponse> {
  const response = await apiClient.get<unknown>("/workspaces");
  const parsed = WorkspacesResponseSchema.parse(response);
  const workspaces = withPersonal(parsed.workspaces);
  const businessCap = parsed.businessCap || BUSINESS_WORKSPACE_CAP;
  return {
    workspaces,
    businessCount: parsed.businessCount,
    businessCap,
    canCreateBusiness: parsed.canCreateBusiness ?? parsed.businessCount < businessCap,
  };
}

/**
 * `GET /api/workspaces/:id/summary` (backend PR #29, workspace.controller.ts) —
 * everything the dashboard hero needs in one call: request totals, status
 * counts, business-only approval/treasury counters, recent activity, and (for
 * the personal workspace only) the split-balance rollup that feeds "Settle
 * up". `personal` is null for a business workspace; `approvalQueueCount` and
 * `treasury` are zeroed, never omitted, for a personal one.
 */
export const WorkspaceSummarySchema = z.object({
  workspace: z.object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(["personal", "business"]),
    initials: z.string(),
    color: z.string(),
    /** null for personal — same rule as WorkspaceSchema above. */
    role: z.string().nullable(),
    memberCount: z.number().int().nonnegative(),
  }),
  totals: z.object({
    outstanding: z.number(),
    received: z.number(),
    currency: z.string(),
    requestCount: z.number().int().nonnegative(),
  }),
  countsByStatus: z.record(z.string(), z.number()),
  approvalQueueCount: z.number().int().nonnegative(),
  treasury: z.object({
    streamsTotal: z.number(),
    streamCount: z.number().int().nonnegative(),
    currency: z.string(),
  }),
  recentActivity: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["request", "organization"]),
      type: z.string(),
      title: z.string().nullable(),
      amount: z.number().nullable(),
      currency: z.string().nullable(),
      status: z.string().nullable(),
      createdAt: z.string(),
    })
  ),
  personal: z
    .object({
      owed: z.number(),
      lent: z.number(),
      groupCount: z.number().int().nonnegative(),
      friendCount: z.number().int().nonnegative(),
    })
    .nullable(),
});

export type WorkspaceSummary = z.infer<typeof WorkspaceSummarySchema>;
export type DashboardActivityItem = WorkspaceSummary["recentActivity"][number];

export async function getWorkspaceSummary(workspaceId: string): Promise<WorkspaceSummary> {
  const response = await apiClient.get<unknown>(
    `/workspaces/${encodeURIComponent(workspaceId)}/summary`
  );
  return WorkspaceSummarySchema.parse(response);
}

export type WorkspaceTreasury = WorkspaceSummary["treasury"];

/**
 * The Treasury screen's hero total is the `treasury` slice of the same
 * `/workspaces/:id/summary` payload the dashboard reads — this just fetches
 * and re-shapes it rather than parsing/summing streams separately, so the two
 * screens can never disagree.
 */
export async function getWorkspaceTreasury(workspaceId: string): Promise<WorkspaceTreasury> {
  const summary = await getWorkspaceSummary(workspaceId);
  return summary.treasury;
}
