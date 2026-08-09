import { z } from "zod";

/////////////////////////////////////////
// GROUP SCHEMA
/////////////////////////////////////////

export const GroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  userId: z.string(),
  description: z.string().nullable(),
  image: z.string().nullable(),
  color: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  // `type` is gone: Group is bill-splitting only. Business workspaces are
  // Organizations (features/business/api/client.ts).
  lockPrice: z.boolean(),
  groupBalances: z.array(
    z.object({
      currency: z.string(),
      amount: z.number(),
      userId: z.string(),
    })
  ).optional().default([]),
});

export type Group = z.infer<typeof GroupSchema>;

export default GroupSchema;
