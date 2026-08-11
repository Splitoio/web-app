import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getExpensesByOrganization,
  createOrganizationExpense,
  updateOrganizationExpense,
  deleteOrganizationExpense,
} from "../api/client";
import { QueryKeys } from "@/lib/constants";

/**
 * Treasury outgoings for a business workspace — the mirror of use-streams.ts.
 * Not to be confused with `useGetExpenses` in features/expenses, which reads
 * the group-scoped bill-splitting list off `/groups/:id/expenses`.
 */
export const useGetExpensesByOrganization = (
  organizationId: string,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: [QueryKeys.ORGANIZATION_EXPENSES, organizationId],
    queryFn: () => getExpensesByOrganization(organizationId),
    enabled: !!organizationId && (options?.enabled !== false),
  });
};

export const useCreateOrganizationExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      payload,
    }: {
      organizationId: string;
      payload: Parameters<typeof createOrganizationExpense>[1];
    }) => createOrganizationExpense(organizationId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.ORGANIZATION_EXPENSES, variables.organizationId],
      });
    },
  });
};

export const useUpdateOrganizationExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      expenseId,
      payload,
    }: {
      organizationId: string;
      expenseId: string;
      payload: Parameters<typeof updateOrganizationExpense>[2];
    }) => updateOrganizationExpense(organizationId, expenseId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.ORGANIZATION_EXPENSES, variables.organizationId],
      });
    },
  });
};

export const useDeleteOrganizationExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, expenseId }: { organizationId: string; expenseId: string }) =>
      deleteOrganizationExpense(organizationId, expenseId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.ORGANIZATION_EXPENSES, variables.organizationId],
      });
    },
  });
};
