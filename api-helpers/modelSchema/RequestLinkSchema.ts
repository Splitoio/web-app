import { z } from 'zod';

/////////////////////////////////////////
// REQUEST LINK SCHEMA
/////////////////////////////////////////

export const RequestLinkSchema = z.object({
  id: z.string().cuid(),
  token: z.string(),
  requestId: z.string(),
  expiresAt: z.coerce.date(),
  createdAt: z.coerce.date(),
})

export type RequestLink = z.infer<typeof RequestLinkSchema>

export default RequestLinkSchema;
