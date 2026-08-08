import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createGroup } from "@/features/groups/api/client";
import { QueryKeys } from "@/lib/constants";

/**
 * Creates a business workspace.
 *
 * There is no `POST /api/workspaces` — a business workspace *is* a
 * `Group` with `type: "BUSINESS"`, so this goes through the existing
 * `POST /api/groups` (group.controller.ts createGroup, which also enforces
 * the 10-workspace cap and 400s at the limit). `name` is the only required
 * field; `color` is optional and becomes the switcher chip's accent.
 *
 * Invalidating GROUPS alone is not enough — the switcher reads WORKSPACES and
 * would keep showing the stale "N / 10" and an incomplete list.
 */
export const useCreateWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name: string; description?: string; color?: string }) =>
      createGroup({ ...payload, type: "BUSINESS" }),
    // Awaited, so by the time the caller's own onSuccess runs the switcher's
    // list already contains the new workspace — switching to an id the list
    // does not know yet would bounce the user back to personal for a beat
    // (contexts/workspace.tsx resolves `active` by lookup).
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GROUPS] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.BUSINESS_ORGANIZATIONS] });
      await queryClient.invalidateQueries({ queryKey: [QueryKeys.WORKSPACES] });
    },
  });
};
