import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptInvite,
  createOrganizationInvite,
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
      // The workspace switcher must know the new workspace before we switch to
      // it, or the context resolves `active` to the personal fallback.
      await queryClient.invalidateQueries({ queryKey: [QueryKeys.WORKSPACES] });
    },
  });
};
