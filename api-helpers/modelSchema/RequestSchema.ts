import { z } from "zod";
import { SplitTypeSchema } from "../inputTypeSchemas/SplitTypeSchema";
import { CurrencyTypeSchema } from "../inputTypeSchemas/CurrencyTypeSchema";

/////////////////////////////////////////
// REQUEST SCHEMA
/////////////////////////////////////////

export const RequestSchema = z.object({
  splitType: SplitTypeSchema,
  currencyType: CurrencyTypeSchema,
  id: z.string().cuid(),
  paidBy: z.string(),
  addedBy: z.string(),
  name: z.string(),
  category: z.string(),
  amount: z.number(),
  expenseDate: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  currency: z.string(),
  tokenId: z.string().nullable(),
  chainId: z.string().nullable(),
  acceptedTokenIds: z.string().array(),
  exchangeRate: z.number().nullable(),
  timeLockIn: z.boolean(),
  fileKey: z.string().nullable(),
  groupId: z.string().nullable(),
  deletedAt: z.coerce.date().nullable(),
  deletedBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
  denominationCurrency: z.string().nullable(),
  destinationAsset: z.string().nullable(),
  destinationChain: z.string().nullable(),
  destinationAddress: z.string().nullable(),
  expiresAt: z.coerce.date().nullable(),
  status: z.string(),
});

export type Request = z.infer<typeof RequestSchema>;

export default RequestSchema;
