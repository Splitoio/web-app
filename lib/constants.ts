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
  ORGANIZATION_MEMBERS: "organization-members",
  ORGANIZATION_INVITES: "organization-invites",
  // The signed-in user's own pending invites (`GET /api/invites/mine`) — a
  // DIFFERENT cache from ORGANIZATION_INVITES, which is one org's invite list
  // seen by an admin managing that org. This one drives the notifications
  // bell/badge and is scoped to the caller's email, not an organizationId.
  MY_INVITES: "my-invites",
  INVOICES: "invoices",
  ORGANIZATION_ACTIVITY: "organization-activity",
  STREAMS: "streams",
  // Org treasury outgoings. Distinct from EXPENSES, which is the group-scoped
  // bill-splitting list — sharing a key would cross-invalidate two unrelated
  // resources.
  ORGANIZATION_EXPENSES: "organization-expenses",
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
