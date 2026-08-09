import { apiClient } from "@/api-helpers/client";
import { z } from "zod";

const GenericResponseSchema = z.object({
  message: z.string(),
  status: z.string(),
});

const FriendInviteSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  status: z.enum(["pending", "accepted"]),
});

const ExpenseParticipantSchema = z.object({
  expenseId: z.string(),
  userId: z.string(),
  amount: z.number(),
  isPaid: z.boolean().default(false),
});

const FriendExpenseSchema = z.object({
  id: z.string(),
  paidBy: z.string(),
  addedBy: z.string(),
  name: z.string(),
  category: z.string(),
  amount: z.number(),
  currency: z.string(),
  splitType: z.string(),
  expenseDate: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
  groupId: z.string().nullable(),
  expenseParticipants: z.array(ExpenseParticipantSchema),
}).passthrough();

const FriendSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  balances: z.array(z.object({ currency: z.string(), amount: z.number() })),
  // True when this person has been addressed but never signed up — the People
  // row shows "Invited" instead of a balance. Defaulted so an older backend
  // (or the iOS build) that omits the field still parses.
  invited: z.boolean().default(false),
  image: z.string().nullable(),
  expenses: z.array(FriendExpenseSchema).default([]),
});

export const inviteFriend = async (payload: {
  email: string;
  sendInviteEmail: boolean;
}) => {
  const response = await apiClient.post("/users/friends/invite", payload);
  return FriendInviteSchema.parse(response);
};

// Add new function for adding friends
export const addFriend = async (friendIdentifier: string) => {
  const response = await apiClient.post("/users/friends/add", {
    friendIdentifier,
  });
  return GenericResponseSchema.parse(response);
};

export const getFriends = async () => {
  const response = await apiClient.get("/users/friends");
  return z.array(FriendSchema).parse(response);
};
