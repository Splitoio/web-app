import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAllOrganizations,
  createOrganization,
  getOrganizationById,
  getOrganizationMembers,
  removeOrganizationMember,
  updateOrganization,
  updateOrganizationMemberRole,
  deleteOrganization,
  type OrgRole,
} from "../api/client";
import { QueryKeys } from "@/lib/constants";

/** Every cache key that a membership or role change can invalidate. */
const invalidateOrg = (
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string
) => {
  queryClient.invalidateQueries({ queryKey: [QueryKeys.BUSINESS_ORGANIZATIONS] });
  queryClient.invalidateQueries({ queryKey: [QueryKeys.ORGANIZATION_MEMBERS, organizationId] });
  // memberCount on the dashboard hero and the setup checklist both read this.
  queryClient.invalidateQueries({ queryKey: [QueryKeys.WORKSPACE_SUMMARY] });
  queryClient.invalidateQueries({ queryKey: [QueryKeys.WORKSPACES] });
};

export const useGetAllOrganizations = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: [QueryKeys.BUSINESS_ORGANIZATIONS],
    queryFn: getAllOrganizations,
    enabled: options?.enabled ?? true,
  });
};

export const useGetOrganizationById = (organizationId: string) => {
  return useQuery({
    queryKey: [QueryKeys.BUSINESS_ORGANIZATIONS, organizationId],
    queryFn: () => getOrganizationById(organizationId),
    enabled: !!organizationId,
  });
};

/**
 * Members are a separate fetch, not a field on the organization — the old
 * `group.groupUsers[]` nesting is gone.
 */
export const useGetOrganizationMembers = (organizationId: string) => {
  return useQuery({
    queryKey: [QueryKeys.ORGANIZATION_MEMBERS, organizationId],
    queryFn: () => getOrganizationMembers(organizationId),
    enabled: !!organizationId,
  });
};

export const useCreateOrganization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrganization,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.BUSINESS_ORGANIZATIONS] });
      await queryClient.invalidateQueries({ queryKey: [QueryKeys.WORKSPACES] });
    },
  });
};

export const useUpdateOrganization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      payload,
    }: {
      organizationId: string;
      payload: { name?: string; description?: string | null; image?: string | null; color?: string | null };
    }) => updateOrganization(organizationId, payload),
    onSuccess: (_, variables) => invalidateOrg(queryClient, variables.organizationId),
  });
};

export const useDeleteOrganization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteOrganization,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.BUSINESS_ORGANIZATIONS] });
      await queryClient.invalidateQueries({ queryKey: [QueryKeys.WORKSPACES] });
    },
  });
};

/**
 * `role` may be OWNER here: only an OWNER may grant or revoke ownership, and
 * the backend refuses to demote the last one (400).
 */
export const useUpdateOrganizationMemberRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      userId,
      role,
    }: {
      organizationId: string;
      userId: string;
      role: OrgRole;
    }) => updateOrganizationMemberRole(organizationId, userId, role),
    onSuccess: (_, variables) => invalidateOrg(queryClient, variables.organizationId),
  });
};

export const useRemoveOrganizationMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, userId }: { organizationId: string; userId: string }) =>
      removeOrganizationMember(organizationId, userId),
    onSuccess: (_, variables) => invalidateOrg(queryClient, variables.organizationId),
  });
};
