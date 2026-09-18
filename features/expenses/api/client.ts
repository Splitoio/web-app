import { apiClient } from "@/api-helpers/client";
import { CurrencyType } from "@/api-helpers/types";

// const ExpenseSchema = z.object({
//   id: z.string(),
//   name: z.string(),
//   amount: z.number(),
//   currency: z.string(),
//   splitType: z.enum(["EQUAL", "PERCENTAGE", "EXACT"]),
//   participants: z.array(
//     z.object({
//       userId: z.string(),
//       amount: z.number(),
//     })
//   ),
// });

// Define a comprehensive type for the expense payload
export interface EnhancedExpensePayload {
  name: string;
  category: string;
  amount: number;
  splitType: string;
  currency: string;
  currencyType: CurrencyType;
  chainId?: string;
  tokenId?: string;
  timeLockIn: boolean;
  participants: Array<{ userId: string; amount: number }>;
  paidBy: string;
  description?: string;
  groupId?: string;
  expenseDate?: string;
}

export const createExpense = async (
  groupId: string,
  payload: EnhancedExpensePayload
): Promise<any> => {
  const response = await apiClient.post(`/groups/${groupId}/expenses`, payload);
  return response;
};

export const getExpenses = async (groupId: string) => {
  const response = await apiClient.get(`/groups/${groupId}/expenses`);
  return (response as unknown as { expenses?: unknown[] }) ?? { expenses: [] };
};


export interface UpdateExpensePayload {
  name: string;
  category: string;
  amount: number;
  splitType: string;
  currency: string;
  participants: Array<{ userId: string; amount: number }>;
  expenseDate?: string;
}

export const updateExpense = async (
  groupId: string,
  expenseId: string,
  payload: UpdateExpensePayload
) => {
  const response = await apiClient.put(
    `/groups/${groupId}/expenses/${expenseId}`,
    payload
  );
  return response;
};

export const deleteExpense = async (groupId: string, expenseId: string) => {
  const response = await apiClient.delete(`/groups/${groupId}/expenses/${expenseId}`);
  return response;
};

export const markParticipantAsPaid = async (expenseId: string, userId: string) => {
  const response = await apiClient.patch(`/expenses/${expenseId}/participants/${userId}/mark-paid`);
  return response;
};
