import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'

/////////////////////////////////////////
// PAYMENT ATTEMPT SCHEMA
/////////////////////////////////////////

export const PaymentAttemptSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  groupId: z.string().nullable(),
  serializedTx: z.string(),
  settleWithId: z.string().nullable(),
  expenseId: z.string().nullable(),
  status: z.string(),
  createdAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  transactionHash: z.string().nullable(),
  chainId: z.string(),
  tokenId: z.string().nullable(),
  quote: JsonValueSchema.nullable(),
  quoteExpiry: z.coerce.date().nullable(),
  route: z.string().nullable(),
})

export type PaymentAttempt = z.infer<typeof PaymentAttemptSchema>

export default PaymentAttemptSchema;
