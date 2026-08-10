import { useQuery } from "@tanstack/react-query";
import { QueryKeys } from "@/lib/constants";
import { getWorkspaceSummary, getWorkspaceTreasury } from "../api/client";

/**
 * The active workspace's treasury totals (income streams received-to-date),
 * as reported by GET /api/workspaces/:id/summary. Kept separate from
 * `useWorkspaces` since it's per-workspace and only Treasury needs it —
 * disabled outside a real (non-personal) workspace id.
 */
export const useWorkspaceTreasury = (workspaceId: string, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: [QueryKeys.WORKSPACE_SUMMARY, workspaceId],
    queryFn: () => getWorkspaceTreasury(workspaceId),
    enabled: !!workspaceId && (options?.enabled ?? true),
  });

/**
 * The full dashboard summary — totals, status counts, approval/treasury
 * counters, recent activity, and (personal workspace only) the split-balance
 * rollup. Same endpoint as `useWorkspaceTreasury` above but parses the whole
 * payload; kept on a distinct query key (rather than `WORKSPACE_SUMMARY`)
 * because the two hooks cache differently-shaped return values and must not
 * collide in the query client.
 */
export const useWorkspaceSummary = (workspaceId: string, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: [QueryKeys.WORKSPACES, "summary", workspaceId],
    queryFn: () => getWorkspaceSummary(workspaceId),
    enabled: !!workspaceId && (options?.enabled ?? true),
    staleTime: 60 * 1000,
  });
