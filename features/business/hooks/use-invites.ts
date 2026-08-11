import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptInvite,
  createOrganizationInvite,
  declineInvite,
  getMyInvites,
  getOrganizationInvites,
  lookupInvite,
  resendInvite,
  revokeInvite,
  type InviteStatus,
} from "../api/client";
import { QueryKeys } from "@/lib/constants";

/**
 * Invites are the ONLY way somebody joins a business workspace, and creating
 * one seats nobody — so the invite list and the member list are separate
 * caches that move independently.
 */
export const useGetOrganizationInvites = (
  organizationId: string,
  options?: { status?: InviteStatus; enabled?: boolean }
) => {
  return useQuery({
    queryKey: [QueryKeys.ORGANIZATION_INVITES, organizationId, options?.status ?? "ALL"],
    queryFn: () => getOrganizationInvites(organizationId, { status: options?.status }),
    enabled: !!organizationId && (options?.enabled ?? true),
  });
};

const invalidateInvites = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: [QueryKeys.ORGANIZATION_INVITES] });
};

export const useCreateOrganizationInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      payload,
    }: {
      organizationId: string;
      payload: { email?: string; role?: "ADMIN" | "MEMBER" };
    }) => createOrganizationInvite(organizationId, payload),
    onSuccess: () => invalidateInvites(queryClient),
  });
};

export const useRevokeInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => revokeInvite(inviteId),
    onSuccess: () => invalidateInvites(queryClient),
  });
};

/**
 * Rotates the token server-side: every link already copied or emailed for this
 * invite stops working. The UI must say so — a silently-dead link is worse
 * than no resend button.
 */
export const useResendInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => resendInvite(inviteId),
    onSuccess: () => invalidateInvites(queryClient),
  });
};

/** PUBLIC — deliberately usable with no session, for the `/invite/[token]` page. */
export const useLookupInvite = (token: string) => {
  return useQuery({
    queryKey: [QueryKeys.ORGANIZATION_INVITES, "lookup", token],
    queryFn: () => lookupInvite(token),
    enabled: !!token,
    retry: false,
  });
};

export const useAcceptInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => acceptInvite(token),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.BUSINESS_ORGANIZATIONS] });
      // An accepted invite drops off `/invites/mine` server-side, so the
      // notifications list and its badge/bell-dot must refetch too.
      queryClient.invalidateQueries({ queryKey: [QueryKeys.MY_INVITES] });
      // The workspace switcher must know the new workspace before we switch to
      // it, or the context resolves `active` to the personal fallback.
      await queryClient.invalidateQueries({ queryKey: [QueryKeys.WORKSPACES] });
    },
  });
};

/**
 * The signed-in user's own pending invites — powers the notifications route
 * plus the bell/badge counts in the shell. Callers gate `enabled` on
 * `isAuthenticated` themselves (see useWorkspaces) since the shell mounts for
 * signed-out visitors too and this endpoint requires a session.
 */
export const useMyInvites = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: [QueryKeys.MY_INVITES],
    queryFn: getMyInvites,
    enabled: options?.enabled ?? true,
  });
};

/**
 * Invitee-scoped decline. Invalidates the same caches as useAcceptInvite —
 * declining seats nobody, so BUSINESS_ORGANIZATIONS/WORKSPACES won't actually
 * change, but the workspace switcher's query still races the invite list on
 * every mutation here and staying symmetric means neither branch can drift
 * out of sync with the other later.
 */
export const useDeclineInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => declineInvite(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.MY_INVITES] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.BUSINESS_ORGANIZATIONS] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.WORKSPACES] });
    },
  });
};
