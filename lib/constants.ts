import type { QueryClient } from "@tanstack/react-query";

export const QueryKeys = {
  AUTH: "auth",
  GROUPS: "groups",
  WORKSPACES: "workspaces",
  FRIENDS: "friends",
  EXPENSES: "expenses",
  BALANCES: "balances",
  USER: "user",
  REMINDERS: "reminders",
  ANALYTICS: "analytics",
  BUSINESS_ORGANIZATIONS: "business-organizations",
  INVOICES: "invoices",
  ORGANIZATION_ACTIVITY: "organization-activity",
  STREAMS: "streams",
  CONTRACTS: "contracts",
  WORKSPACE_SUMMARY: "workspace-summary",
} as const;

// Utility function to invalidate all relevant caches after settlement
export const invalidateSettlementCaches = (queryClient: QueryClient, groupId?: string) => {
  const queriesToInvalidate: (string | string[])[] = [
    [QueryKeys.BALANCES],
    [QueryKeys.GROUPS],
    [QueryKeys.FRIENDS],
    [QueryKeys.ANALYTICS],
    [QueryKeys.EXPENSES],
  ];

  // Add specific group query if groupId is provided
  if (groupId) {
    queriesToInvalidate.push([QueryKeys.GROUPS, groupId]);
  }

  // Invalidate all queries (queryKey must be an array for QueryClient)
  queriesToInvalidate.forEach(queryKey => {
    const key = Array.isArray(queryKey) ? queryKey : [queryKey];
    queryClient.invalidateQueries({ queryKey: key });
  });

  // Force refetch critical queries
  queryClient.refetchQueries({ queryKey: [QueryKeys.BALANCES] });
  queryClient.refetchQueries({ queryKey: [QueryKeys.GROUPS] });
};
