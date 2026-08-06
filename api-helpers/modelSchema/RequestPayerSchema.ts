import { z } from 'zod';

/////////////////////////////////////////
// REQUEST PAYER SCHEMA
/////////////////////////////////////////

export const RequestPayerSchema = z.object({
  requestId: z.string(),
  userId: z.string(),
  amount: z.number(),
  isPaid: z.boolean(),
  shareAmount: z.number().nullable(),
})

export type RequestPayer = z.infer<typeof RequestPayerSchema>

export default RequestPayerSchema;
