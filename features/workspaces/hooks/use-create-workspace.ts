import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOrganization } from "@/features/business/api/client";
import { QueryKeys } from "@/lib/constants";

/**
 * Creates a business workspace.
 *
 * A business workspace is an `Organization`, not a group. This used to POST
 * `/api/groups` with `type: "BUSINESS"` — that field is now IGNORED, so the
 * old call still returned 200 and quietly produced a plain bill-splitting
 * group that never showed up in the switcher. `POST /api/organizations`
 * creates the org and the caller's OWNER membership in one transaction and
 * enforces the 10-workspace cap (400 at the limit).
 *
 * Invalidating BUSINESS_ORGANIZATIONS alone is not enough — the switcher reads
 * WORKSPACES and would keep showing the stale "N / 10" and an incomplete list.
 */
export const useCreateWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name: string; description?: string; color?: string }) =>
      createOrganization(payload),
    // Awaited, so by the time the caller's own onSuccess runs the switcher's
    // list already contains the new workspace — switching to an id the list
    // does not know yet would bounce the user back to personal for a beat
    // (contexts/workspace.tsx resolves `active` by lookup).
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.BUSINESS_ORGANIZATIONS] });
      await queryClient.invalidateQueries({ queryKey: [QueryKeys.WORKSPACES] });
    },
  });
};
