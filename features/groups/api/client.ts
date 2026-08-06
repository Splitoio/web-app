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
export const createGroup = async (payload: {
  name: string;
  description?: string;
  imageUrl?: string;
  color?: string;
  type?: "PERSONAL" | "BUSINESS";
}) => {
  const response = await apiClient.post("/groups", payload);
  return GroupSchema.parse(response);
};

export const getAllGroups = async (params?: { type?: "PERSONAL" | "BUSINESS" }) => {
  const response = await apiClient.get("/groups", { params });
  return GetAllGroupsSchema.array().parse(response);
};

export const getGroupById = async (
  groupId: string,
  options?: { type?: "PERSONAL" | "BUSINESS" }
) => {
  const params = options?.type ? { type: options.type } : undefined;
  const response = await apiClient.get(`/groups/${groupId}`, { params });
  return DetailGroupSchema.safeParse(response).data;
};

export const getAllGroupsWithBalances = async (params?: { type?: "PERSONAL" | "BUSINESS" }) => {
  const query = params?.type ? { type: params.type } : undefined;
  const response = await apiClient.get("/groups/balances", { params: query });
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

export const updateMemberRole = async (
  groupId: string,
  userId: string,
  role: "ADMIN" | "MEMBER"
) => {
  const response = await apiClient.put(`/groups/${groupId}/members/${userId}/role`, { role });
  return response;
};

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
