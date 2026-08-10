import { z } from "zod";

export const UpdateUserResponseSchema = z.object({
  name: z.string().optional(),
  currency: z.string().optional(),
  currencyDisplay: z.enum(["both", "real", "converted"]).optional(),
  stellarAccount: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  preferredChain: z.string().nullable().optional(),
  onboardedPersonal: z.boolean().optional(),
  onboardedOrgInOrg: z.boolean().optional(),
  // Account-level default for whether a new request locks its exchange rate.
  // updateUserDetails (backend user.controller.ts) already reads and persists
  // this field on User — it was just missing from the accepted payload shape.
  timeLockInDefault: z.boolean().optional(),
});
