import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addMembersToGroup,
  addOrEditExpense,
  createGroup,
  deleteGroup,
  ExpensePayload,
  getAllGroups,
  getAllGroupsWithBalances,
  getGroupById,
  joinGroup,
  updateGroup,
  removeMemberFromGroup as removeMemberFromGroupApi,
  markAsPaid,
  getGroupAcceptedTokens,
  addGroupAcceptedToken,
  removeGroupAcceptedToken,
} from "../api/client";
import { QueryKeys } from "@/lib/constants";

export const useCreateGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GROUPS] });
    },
  });
};

export const useGetAllGroups = () => {
  return useQuery({
    queryKey: [QueryKeys.GROUPS, "list"],
    queryFn: getAllGroups,
  });
};

export const useGetAllGroupsWithBalances = () => {
  return useQuery({
    queryKey: [QueryKeys.BALANCES, "list"],
    queryFn: getAllGroupsWithBalances,
  });
};

export const useJoinGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: joinGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GROUPS] });
    },
  });
};

export const useAddOrEditExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      groupId,
      payload,
    }: {
      groupId: string;
      payload: ExpensePayload;
    }) => addOrEditExpense(groupId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GROUPS] });
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.EXPENSES],
      });
    },
  });
};

export const useGetGroupById = (groupId: string) => {
  return useQuery({
    queryKey: [QueryKeys.GROUPS, groupId],
    queryFn: () => getGroupById(groupId),
    enabled: !!groupId,
  });
};

export const useAddMembersToGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      groupId,
      memberIdentifier,
    }: {
      groupId: string;
      memberIdentifier: string;
    }) => addMembersToGroup(groupId, memberIdentifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GROUPS] });
    },
  });
};

export const useDeleteGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GROUPS] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.BUSINESS_ORGANIZATIONS] });
    },
    onError: (error: any) => {
      // Check for uncleared dues error - this assumes the API returns a specific message
      // when a group can't be deleted due to uncleared dues
      if (
        error?.message?.toLowerCase().includes("dues") ||
        error?.message?.toLowerCase().includes("balance") ||
        error?.data?.message?.toLowerCase().includes("dues") ||
        error?.data?.message?.toLowerCase().includes("balance")
      ) {
        return {
          type: "uncleared_dues",
          message: error.message || "Cannot delete group with uncleared dues",
        };
      }

      // Return a generic error otherwise
      return {
        type: "generic_error",
        message: error.message || "Failed to delete group",
      };
    },
  });
};

export const useUpdateGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      groupId,
      payload,
    }: {
      groupId: string;
      payload: {
        name?: string;
        description?: string;
        imageUrl?: string;
        lockPrice?: boolean;
      };
    }) => updateGroup(groupId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GROUPS] });
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.GROUPS, variables.groupId],
      });
    },
  });
};

// `useUpdateMemberRole` is gone with the endpoint — split groups have no roles.
// See features/business/hooks/use-organizations.ts for organization roles.

export const useRemoveMemberFromGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      removeMemberFromGroupApi(groupId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GROUPS] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GROUPS, variables.groupId] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.BUSINESS_ORGANIZATIONS] });
    },
  });
};

export const useMarkAsPaid = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, payload }: { groupId: string; payload: { payerId: string; payeeId: string; amount: number; currency?: string; currencyType?: string } }) =>
      markAsPaid(groupId, payload),
    onSuccess: (_, variables) => {
      // Invalidate group data
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GROUPS] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GROUPS, variables.groupId] });
      
      // Invalidate expenses
      queryClient.invalidateQueries({ queryKey: [QueryKeys.EXPENSES] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.EXPENSES, variables.groupId] });
      
      // Invalidate balances
      queryClient.invalidateQueries({ queryKey: [QueryKeys.BALANCES] });
      
      // Invalidate analytics
      queryClient.invalidateQueries({ queryKey: [QueryKeys.ANALYTICS] });
    },
  });
};

const groupAcceptedTokensKey = (groupId: string) => [QueryKeys.GROUPS, groupId, "accepted-tokens"];

export const useGetGroupAcceptedTokens = (groupId: string) => {
  return useQuery({
    queryKey: groupAcceptedTokensKey(groupId),
    queryFn: () => getGroupAcceptedTokens(groupId),
    enabled: !!groupId,
  });
};

export const useAddGroupAcceptedToken = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, payload }: { groupId: string; payload: { tokenId: string; chainId: string; isDefault?: boolean } }) =>
      addGroupAcceptedToken(groupId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: groupAcceptedTokensKey(variables.groupId) });
    },
  });
};

export const useRemoveGroupAcceptedToken = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, id }: { groupId: string; id: string }) => removeGroupAcceptedToken(groupId, id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: groupAcceptedTokensKey(variables.groupId) });
    },
  });
};
