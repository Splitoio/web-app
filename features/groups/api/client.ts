import { apiClient } from "@/api-helpers/client";
import {
  RequestSchema,
  RequestPayerSchema,
  GroupBalanceSchema,
  GroupSchema,
  GroupUserSchema,
  UserSchema,
} from "@/api-helpers/modelSchema";
import { z } from "zod";
import { CurrencyType } from "@/api-helpers/types";

export const GenericResponseSchema = z.object({
  message: z.string(),
  success: z.boolean(),
});

export const GetAllGroupsSchema = z.object({
  ...GroupSchema.shape,

  createdBy: z.object({
    id: z.string(),
    name: z.string(),
  }),
  groupBalances: z.array(GroupBalanceSchema).optional().default([]),
  groupUsers: z.array(z.any()).optional().default([]),
  expenses: z.array(RequestSchema).optional().default([]),
});

export const ExpenseWithParticipantsSchema = RequestSchema.extend({
  expenseParticipants: z.array(RequestPayerSchema).optional(),
});

export const DetailGroupSchema = z.object({
  ...GroupSchema.shape,
  groupUsers: z.array(
    z.object({
      ...GroupUserSchema.shape,
      createdAt: z.coerce.date().optional(),
      user: UserSchema,
    })
  ),
  expenses: z.array(ExpenseWithParticipantsSchema),
  groupBalances: z.array(GroupBalanceSchema),
  createdBy: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

export type DetailGroup = z.infer<typeof DetailGroupSchema>;

/**
 * `Group` is bill-splitting ONLY. The `type` discriminator is gone from the
 * schema and every group endpoint IGNORES a `type` param — so asking these for
 * "business" data silently returns personal split groups rather than erroring.
 * Business workspaces live at /api/organizations (features/business/api/client.ts).
 */
export const createGroup = async (payload: {
  name: string;
  description?: string;
  imageUrl?: string;
  color?: string;
}) => {
  const response = await apiClient.post("/groups", payload);
  return GroupSchema.parse(response);
};

export const getAllGroups = async () => {
  const response = await apiClient.get("/groups");
  return GetAllGroupsSchema.array().parse(response);
};

export const getGroupById = async (groupId: string) => {
  const response = await apiClient.get(`/groups/${groupId}`);
  return DetailGroupSchema.safeParse(response).data;
};

export const getAllGroupsWithBalances = async () => {
  const response = await apiClient.get("/groups/balances");
  return GroupSchema.array().parse(response);
};

export const joinGroup = async (groupId: string) => {
  const response = await apiClient.post(`/groups/join/${groupId}`);
  return GroupSchema.parse(response);
};

export const createGroupInviteLink = async (
  groupId: string
): Promise<{ inviteLink: string; expiresAt: string }> => {
  const response = await apiClient.post<{ inviteLink: string; expiresAt: string }>(
    `/groups/${groupId}/invite-link`
  );
  return response as unknown as { inviteLink: string; expiresAt: string };
};

export const joinGroupByToken = async (
  token: string
): Promise<{ groupId: string; message?: string }> => {
  const response = await apiClient.post<{ groupId: string; message?: string }>("/groups/join", {
    token,
  });
  return response as unknown as { groupId: string; message?: string };
};

export const addMembersToGroup = async (
  groupId: string,
  memberIdentifier: string
) => {
  const response = await apiClient.post(`/groups/addMember`, {
    groupId,
    memberIdentifier,
  });
  return GenericResponseSchema.parse(response);
};

export interface ExpensePayload {
  amount: number;
  name: string;
  description: string;
  paidBy: string;
  splitType: string;
  participants: Array<{ userId: string; amount: number }>;
  currency: string;
  currencyType: CurrencyType;
  chainId?: string;
  tokenId?: string;
  timeLockIn: boolean;
  convertedAmount?: number;
  category?: string;
  groupId?: string;
}

export const addOrEditExpense = async (
  groupId: string,
  payload: ExpensePayload
) => {
  const response = await apiClient.post(`/groups/${groupId}/expenses`, payload);
  return response;
};

export const deleteGroup = async (groupId: string) => {
  const response = await apiClient.delete(`/groups/${groupId}`);
  return GenericResponseSchema.parse(response);
};

// `PUT /groups/:groupId/members/:userId/role` is GONE: roles were only ever a
// business concept and `GroupUser.role` no longer exists. Organization roles
// go through PATCH /api/organizations/:id/members/:userId instead.

export const removeMemberFromGroup = async (groupId: string, userId: string) => {
  const response = await apiClient.delete(`/groups/${groupId}/members/${userId}`);
  return response;
};

export const updateGroup = async (
  groupId: string,
  payload: {
    name?: string;
    description?: string;
    imageUrl?: string;
    lockPrice?: boolean;
  }
) => {
  const filteredPayload: any = {};
  if (payload.name !== undefined) filteredPayload.name = payload.name;
  if (payload.lockPrice !== undefined)
    filteredPayload.lockPrice = payload.lockPrice;
  if (payload.imageUrl !== undefined)
    filteredPayload.imageUrl = payload.imageUrl;
  if (payload.description !== undefined)
    filteredPayload.description = payload.description;

  const response = await apiClient.put(`/groups/${groupId}`, filteredPayload);

  // Try to parse, but fallback to raw response if parsing fails
  try {
    return GroupSchema.parse(response);
  } catch (e) {
    if (response && (response as any).id) return response;
    throw e;
  }
};

export const markAsPaid = async (
  groupId: string,
  payload: {
    payerId: string;
    payeeId: string;
    amount: number;
    currency?: string;
    currencyType?: string;
  }
) => {
  const response = await apiClient.post(
    `/groups/${groupId}/mark-paid`,
    payload
  );
  return response;
};

// ─── Group accepted tokens (per-workspace settlement override) ──────────────
// Mirrors features/user/api/client.ts's accepted-tokens trio, scoped to a
// business workspace instead of the account. GroupAcceptedToken rows have
// their own id — that row id, not the underlying Token's id, is what
// removeGroupAcceptedToken's URL param takes (see group.controller.ts
// removeGroupAcceptedToken: it looks up by GroupAcceptedToken.id).

export interface GroupAcceptedToken {
  id: string;
  groupId: string;
  tokenId: string;
  chainId: string;
  isDefault: boolean;
  symbol: string;
  chainName?: string;
}

export const getGroupAcceptedTokens = async (groupId: string): Promise<GroupAcceptedToken[]> => {
  const response = await apiClient.get(`/groups/${groupId}/accepted-tokens`);
  return (response as unknown as GroupAcceptedToken[]) || [];
};

export const addGroupAcceptedToken = async (
  groupId: string,
  payload: { tokenId: string; chainId: string; isDefault?: boolean }
): Promise<void> => {
  // The backend's $executeRaw response shape for this endpoint isn't reliable
  // JSON, so callers refetch the list via query invalidation instead of
  // trusting a return value here.
  await apiClient.post(`/groups/${groupId}/accepted-tokens`, payload);
};

export const removeGroupAcceptedToken = async (groupId: string, acceptedTokenId: string): Promise<void> => {
  await apiClient.delete(`/groups/${groupId}/accepted-tokens/${acceptedTokenId}`);
};
