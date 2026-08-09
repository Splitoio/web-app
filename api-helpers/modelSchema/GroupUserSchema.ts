import { z } from 'zod';

/////////////////////////////////////////
// GROUP USER SCHEMA
/////////////////////////////////////////

export const GroupUserSchema = z.object({
  groupId: z.string(),
  userId: z.string(),
  // No `role`: roles were only ever a business concept and now live on
  // OrganizationMember, not on this join table.
})

export type GroupUser = z.infer<typeof GroupUserSchema>

export default GroupUserSchema;
