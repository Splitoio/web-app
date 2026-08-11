import { apiClient } from "@/api-helpers/client";
import { z } from "zod";

/**
 * Business workspaces are `Organization` rows, NOT groups.
 *
 * `Group` is bill-splitting only now: `GET /api/groups` ignores a `type` query
 * param and `POST /api/groups` ignores a `type` body field, so anything that
 * still asked the group endpoints for "business" data would silently render
 * personal split groups instead of erroring. Every organization read/write
 * below goes to `/api/organizations`.
 */
export const OrgRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);
export type OrgRole = z.infer<typeof OrgRoleSchema>;

/** `role` is the CALLER's role in the org, not a property of the org itself. */
export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  role: OrgRoleSchema,
  /** Present on the list (`joinedAt`) and on create/detail (`memberCount`). */
  joinedAt: z.coerce.date().optional(),
  memberCount: z.number().int().nonnegative().optional(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

/**
 * `GET /api/organizations/:id/members` — a FLAT list. It is not nested inside
 * the organization payload the way `groupUsers` was nested in a group, so the
 * detail screen fetches it separately.
 */
export const OrganizationMemberSchema = z.object({
  userId: z.string(),
  role: OrgRoleSchema,
  joinedAt: z.coerce.date(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  image: z.string().nullable(),
});
export type OrganizationMember = z.infer<typeof OrganizationMemberSchema>;

export const InviteStatusSchema = z.enum(["PENDING", "ACCEPTED", "REVOKED"]);
export type InviteStatus = z.infer<typeof InviteStatusSchema>;

/**
 * An invite is a PENDING offer — it creates no user and no membership. Nobody
 * appears in the member list until they accept, so the members screen has to
 * show invites as their own thing rather than pretending the person was added.
 */
export const OrganizationInviteSchema = z.object({
  id: z.string(),
  /** null = a shareable link invite anyone holding the token may accept. */
  email: z.string().nullable(),
  role: OrgRoleSchema,
  status: InviteStatusSchema,
  expiresAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  acceptedAt: z.coerce.date().nullable(),
  contractId: z.string().nullable(),
  kind: z.enum(["email", "link"]),
  createdBy: z
    .object({ id: z.string(), name: z.string().nullable(), email: z.string().nullable() })
    .nullable(),
  /** Only returned by create/resend — the list never leaks the token. */
  inviteUrl: z.string().optional(),
  /**
   * Only returned by create/resend, and only when the invite has an email
   * (link-only invites never attempt delivery). `false` means the invite row
   * is still valid — the admin just needs to share `inviteUrl` manually.
   */
  emailDelivered: z.boolean().optional(),
  /** User-facing reason, present only when `emailDelivered` is `false`. */
  deliveryError: z.string().optional(),
});
export type OrganizationInvite = z.infer<typeof OrganizationInviteSchema>;

export const InvoiceStatusSchema = z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED", "APPROVED", "DECLINED", "CLEARED"]);
export const InvoiceSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  issuerId: z.string(),
  recipientId: z.string().nullable(),
  amount: z.number(),
  currency: z.string(),
  status: InvoiceStatusSchema,
  dueDate: z.coerce.date(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable().optional(),
  fileKey: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  issuer: z.object({ id: z.string(), name: z.string().nullable(), image: z.string().nullable(), email: z.string().nullable() }).optional(),
  recipient: z.object({ id: z.string(), name: z.string().nullable(), image: z.string().nullable(), email: z.string().nullable() }).optional().nullable(),
  organization: z.object({ id: z.string(), name: z.string() }).optional(),
});

export const OrganizationActivityTypeSchema = z.enum([
  "INVOICE_RAISED",
  "INVOICE_APPROVED",
  "INVOICE_DECLINED",
  "INVOICE_CLEARED",
  "CONTRACT_CREATED",
  "CONTRACT_SIGNED",
]);
export const OrganizationActivitySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  type: OrganizationActivityTypeSchema,
  invoiceId: z.string().nullable(),
  contractId: z.string().nullable().optional(),
  userId: z.string(),
  note: z.string().nullable(),
  createdAt: z.coerce.date(),
  user: z.object({ id: z.string(), name: z.string().nullable(), image: z.string().nullable(), email: z.string().nullable() }).optional(),
  invoice: z
    .object({
      id: z.string(),
      amount: z.number(),
      currency: z.string(),
      issuer: z.object({ id: z.string(), name: z.string().nullable() }).optional(),
      recipient: z.object({ id: z.string(), name: z.string().nullable() }).optional().nullable(),
    })
    .nullable()
    .optional(),
  contract: z
    .object({
      id: z.string(),
      title: z.string().nullable(),
      jobTitle: z.string().nullable().optional(),
      assignedToEmail: z.string().optional(),
      assignedTo: z.object({ id: z.string(), name: z.string().nullable(), email: z.string().nullable() }).nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type OrganizationActivity = z.infer<typeof OrganizationActivitySchema>;

export const IncomeStreamSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  currency: z.string(),
  amount: z.number(),
  description: z.string().nullable(),
  receivedDate: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type IncomeStream = z.infer<typeof IncomeStreamSchema>;

/**
 * A treasury outgoing, the mirror of `IncomeStream`. NOT the group-scoped
 * `Expense` in features/expenses — that one belongs to bill-splitting and
 * carries participants and shares.
 */
export const OrganizationExpenseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  currency: z.string(),
  amount: z.number(),
  description: z.string().nullable(),
  spentDate: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type OrganizationExpense = z.infer<typeof OrganizationExpenseSchema>;

export type Invoice = z.infer<typeof InvoiceSchema>;

export const getAllOrganizations = async () => {
  const response = await apiClient.get("/organizations");
  return OrganizationSchema.array().parse(response);
};

export const createOrganization = async (payload: {
  name: string;
  description?: string;
  image?: string;
  color?: string;
}) => {
  const response = await apiClient.post("/organizations", payload);
  return OrganizationSchema.parse(response);
};

export const getOrganizationById = async (organizationId: string) => {
  const response = await apiClient.get(`/organizations/${organizationId}`);
  return OrganizationSchema.safeParse(response).data;
};

export const updateOrganization = async (
  organizationId: string,
  payload: { name?: string; description?: string | null; image?: string | null; color?: string | null }
) => {
  const response = await apiClient.patch(`/organizations/${organizationId}`, payload);
  return OrganizationSchema.parse(response);
};

export const deleteOrganization = async (organizationId: string) => {
  await apiClient.delete(`/organizations/${organizationId}`);
};

// ─── Members ────────────────────────────────────────────────────────────────

export const getOrganizationMembers = async (organizationId: string) => {
  const response = await apiClient.get(`/organizations/${organizationId}/members`);
  return OrganizationMemberSchema.array().parse(response);
};

/**
 * The role a member ends up with is set once, here or at invite acceptance —
 * there is no "add then demote" second request any more.
 */
export const updateOrganizationMemberRole = async (
  organizationId: string,
  userId: string,
  role: OrgRole
) => {
  const response = await apiClient.patch(
    `/organizations/${organizationId}/members/${userId}`,
    { role }
  );
  return z
    .object({ success: z.boolean(), userId: z.string(), role: OrgRoleSchema })
    .parse(response);
};

export const removeOrganizationMember = async (organizationId: string, userId: string) => {
  await apiClient.delete(`/organizations/${organizationId}/members/${userId}`);
};

// ─── Invites ────────────────────────────────────────────────────────────────

export const getOrganizationInvites = async (
  organizationId: string,
  params?: { status?: InviteStatus }
) => {
  const response = await apiClient.get(`/organizations/${organizationId}/invites`, {
    params: params?.status ? { status: params.status } : undefined,
  });
  return OrganizationInviteSchema.array().parse(response);
};

/**
 * ONE request per invite. Omit `email` for a shareable link invite; omit
 * `role` for MEMBER. `role: "OWNER"` is a 400 — ownership is transferred
 * explicitly, never handed out by a link.
 */
export const createOrganizationInvite = async (
  organizationId: string,
  payload: { email?: string; role?: "ADMIN" | "MEMBER" }
) => {
  const response = await apiClient.post(`/organizations/${organizationId}/invites`, payload);
  return OrganizationInviteSchema.parse(response);
};

export const revokeInvite = async (inviteId: string) => {
  const response = await apiClient.post(`/invites/${inviteId}/revoke`, {});
  return OrganizationInviteSchema.parse(response);
};

/** Resend ROTATES the token, so any link copied earlier stops working. */
export const resendInvite = async (inviteId: string) => {
  const response = await apiClient.post(`/invites/${inviteId}/resend`, {});
  return OrganizationInviteSchema.parse(response);
};

/**
 * `GET /api/invites/lookup?token=` — PUBLIC, no session. The landing page has
 * to name the workspace and the invited email before the visitor has an
 * account, otherwise signing up is a leap of faith.
 */
export const InviteLookupSchema = z.object({
  organization: z.object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable(),
    color: z.string().nullable(),
  }),
  email: z.string().nullable(),
  role: OrgRoleSchema,
  status: InviteStatusSchema,
  expiresAt: z.coerce.date(),
  expired: z.boolean(),
  /** Redeemable at all, independent of who is looking at it. */
  acceptable: z.boolean(),
  invitedByName: z.string().nullable(),
  contractId: z.string().nullable(),
});
export type InviteLookup = z.infer<typeof InviteLookupSchema>;

export const lookupInvite = async (token: string) => {
  const response = await apiClient.get("/invites/lookup", { params: { token } });
  return InviteLookupSchema.parse(response);
};

export const AcceptInviteResultSchema = z.object({
  success: z.boolean(),
  organizationId: z.string(),
  organizationName: z.string(),
  role: OrgRoleSchema,
  alreadyMember: z.boolean(),
});
export type AcceptInviteResult = z.infer<typeof AcceptInviteResultSchema>;

export const acceptInvite = async (token: string) => {
  const response = await apiClient.post("/invites/accept", { token });
  return AcceptInviteResultSchema.parse(response);
};

/**
 * `GET /api/invites/mine` — the signed-in user's own pending invites, already
 * filtered server-side to PENDING + non-expired + addressed to the caller's
 * email. Drives the in-app notifications surface; `lookupInvite` above stays
 * the public, token-scoped read for the `/invite/[token]` landing page.
 */
export const MyInviteSchema = z.object({
  id: z.string(),
  token: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  role: OrgRoleSchema,
  invitedByName: z.string().nullable(),
  invitedByEmail: z.string().nullable(),
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
});
export type MyInvite = z.infer<typeof MyInviteSchema>;

export const getMyInvites = async () => {
  const response = await apiClient.get("/invites/mine");
  return z.object({ invites: MyInviteSchema.array() }).parse(response).invites;
};

/** Invitee-scoped — the invited person turning an offer down, not an org admin revoking it. */
export const declineInvite = async (inviteId: string) => {
  await apiClient.post(`/invites/${inviteId}/decline`, {});
};

export const createInvoice = async (payload: {
  organizationId: string;
  amount: number;
  currency: string;
  dueDate: string;
  description?: string;
  status?: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED" | "APPROVED" | "DECLINED" | "CLEARED";
  imageUrl?: string;
  fileKey?: string;
  contractId?: string;
}) => {
  const response = await apiClient.post("/invoices", payload);
  return InvoiceSchema.parse(response);
};

export const getInvoicesByOrganization = async (organizationId: string) => {
  const response = await apiClient.get(`/invoices/organization/${organizationId}`);
  return InvoiceSchema.array().parse(response);
};

export const getInvoiceById = async (invoiceId: string) => {
  const response = await apiClient.get(`/invoices/${invoiceId}`);
  return InvoiceSchema.parse(response);
};

export const updateInvoice = async (
  invoiceId: string,
  payload: {
    amount?: number;
    currency?: string;
    dueDate?: string;
    description?: string;
    status?: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED" | "APPROVED" | "DECLINED" | "CLEARED";
    imageUrl?: string;
    fileKey?: string;
  }
) => {
  const response = await apiClient.patch(`/invoices/${invoiceId}`, payload);
  return InvoiceSchema.parse(response);
};

export const approveInvoice = async (invoiceId: string) => {
  const response = await apiClient.patch(`/invoices/${invoiceId}/approve`, {});
  return InvoiceSchema.parse(response);
};

export const declineInvoice = async (invoiceId: string, note?: string) => {
  const response = await apiClient.patch(`/invoices/${invoiceId}/decline`, { note });
  return InvoiceSchema.parse(response);
};

export const markInvoiceAsPaid = async (invoiceId: string) => {
  const response = await apiClient.patch(`/invoices/${invoiceId}/paid`, {});
  return InvoiceSchema.parse(response);
};

export const clearInvoice = async (invoiceId: string) => {
  const response = await apiClient.patch(`/invoices/${invoiceId}/clear`, {});
  return InvoiceSchema.parse(response);
};

export const getOrganizationActivity = async (organizationId: string) => {
  const response = await apiClient.get(`/invoices/organization/${organizationId}/activity`);
  return OrganizationActivitySchema.array().parse(response);
};

export const getOrganizationAnalytics = async (organizationId: string, range: "week" | "month" | "year" = "week") => {
  const response = await apiClient.get(`/invoices/organization/${organizationId}/analytics?range=${range}`);
  return response as unknown as {
    expenseThisMonth: number;
    totalPaid: number;
    outflowByPeriod: { month: string; outflow: number }[];
  };
};

export const deleteInvoice = async (invoiceId: string) => {
  await apiClient.delete(`/invoices/${invoiceId}`);
};

// Income received entries — fills the org treasury (admin only). These moved
// off `/api/groups/:groupId/streams` with everything else business-shaped;
// same verbs, same bodies, organization id in the path.
export const getStreamsByOrganization = async (organizationId: string) => {
  const response = await apiClient.get(`/organizations/${organizationId}/streams`);
  return IncomeStreamSchema.array().parse(response);
};

export const createStream = async (
  organizationId: string,
  payload: { name: string; currency?: string; amount: number; description?: string | null; receivedDate?: string }
) => {
  const response = await apiClient.post(`/organizations/${organizationId}/streams`, payload);
  return IncomeStreamSchema.parse(response);
};

export const updateStream = async (
  organizationId: string,
  streamId: string,
  payload: { name?: string; currency?: string; amount?: number; description?: string | null; receivedDate?: string }
) => {
  const response = await apiClient.put(`/organizations/${organizationId}/streams/${streamId}`, payload);
  return IncomeStreamSchema.parse(response);
};

export const deleteStream = async (organizationId: string, streamId: string) => {
  await apiClient.delete(`/organizations/${organizationId}/streams/${streamId}`);
};

// Treasury outgoings (admin only) — the mirror of the stream calls above.
export const getExpensesByOrganization = async (organizationId: string) => {
  const response = await apiClient.get(`/organizations/${organizationId}/expenses`);
  return OrganizationExpenseSchema.array().parse(response);
};

export const createOrganizationExpense = async (
  organizationId: string,
  payload: { name: string; currency?: string; amount: number; description?: string | null; spentDate?: string }
) => {
  const response = await apiClient.post(`/organizations/${organizationId}/expenses`, payload);
  return OrganizationExpenseSchema.parse(response);
};

export const updateOrganizationExpense = async (
  organizationId: string,
  expenseId: string,
  payload: { name?: string; currency?: string; amount?: number; description?: string | null; spentDate?: string }
) => {
  const response = await apiClient.put(`/organizations/${organizationId}/expenses/${expenseId}`, payload);
  return OrganizationExpenseSchema.parse(response);
};

export const deleteOrganizationExpense = async (organizationId: string, expenseId: string) => {
  await apiClient.delete(`/organizations/${organizationId}/expenses/${expenseId}`);
};

// Contracts
export const ContractStatusSchema = z.enum(["DRAFT", "SENT", "REJECTED", "REVOKED"]);
export const ContractSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  createdById: z.string(),
  /** Always lowercased by the backend now — compare case-insensitively anyway. */
  assignedToEmail: z.string(),
  /**
   * The PENDING invite `createContract` creates alongside the contract, so a
   * contract and a direct invite land in the same pending list. Absent on
   * contracts written before invites existed.
   */
  inviteId: z.string().nullable().optional(),
  assignedToUserId: z.string().nullable(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  compensationAmount: z.number().nullable(),
  compensationCurrency: z.string().nullable(),
  pdfFileKey: z.string().nullable(),
  status: ContractStatusSchema,
  jobTitle: z.string().nullable().optional(),
  scopeOfWork: z.string().nullable().optional(),
  paymentFrequency: z.enum(["MONTHLY", "WEEKLY", "ONE_TIME"]).nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  noticePeriodDays: z.number().nullable().optional(),
  specialClause: z.string().nullable().optional(),
  signedAt: z.coerce.date().nullable().optional(),
  signerName: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  organization: z.object({ id: z.string(), name: z.string() }).optional(),
  createdBy: z.object({ id: z.string(), name: z.string().nullable(), email: z.string().nullable() }).optional(),
  assignedTo: z.object({ id: z.string(), name: z.string().nullable(), email: z.string().nullable() }).optional().nullable(),
});
export type Contract = z.infer<typeof ContractSchema>;

export const getContractsByOrganization = async (organizationId: string) => {
  const response = await apiClient.get(`/contracts/organization/${organizationId}`);
  return ContractSchema.array().parse(response);
};

export const getContractByToken = async (token: string) => {
  const response = await apiClient.get("/contracts/view", { params: { token } });
  return z.object({ contract: ContractSchema, token: z.string() }).parse(response);
};

export const getMyContracts = async () => {
  const response = await apiClient.get("/contracts/my");
  return ContractSchema.array().parse(response);
};

export const getContractById = async (contractId: string) => {
  const response = await apiClient.get(`/contracts/${contractId}`);
  return ContractSchema.parse(response);
};

export const createContract = async (payload: {
  organizationId: string;
  assignedToEmail: string;
  title?: string;
  description?: string;
  compensationAmount?: number;
  compensationCurrency?: string;
  jobTitle?: string;
  scopeOfWork?: string;
  paymentFrequency?: "MONTHLY" | "WEEKLY" | "ONE_TIME";
  startDate?: string | null;
  endDate?: string | null;
  noticePeriodDays?: number | null;
  specialClause?: string | null;
}) => {
  const response = await apiClient.post("/contracts", payload);
  return ContractSchema.parse(response);
};

export const updateContract = async (
  contractId: string,
  payload: {
    assignedToEmail?: string;
    title?: string;
    description?: string;
    compensationAmount?: number;
    compensationCurrency?: string;
    jobTitle?: string | null;
    scopeOfWork?: string | null;
    paymentFrequency?: "MONTHLY" | "WEEKLY" | "ONE_TIME" | null;
    startDate?: string | null;
    endDate?: string | null;
    noticePeriodDays?: number | null;
    specialClause?: string | null;
  }
) => {
  const response = await apiClient.patch(`/contracts/${contractId}`, payload);
  return ContractSchema.parse(response);
};

export const signContract = async (
  contractId: string,
  payload: { signatureDataUrl: string; signerName: string }
) => {
  const response = await apiClient.patch(`/contracts/${contractId}/sign`, payload);
  return ContractSchema.parse(response);
};

export const rejectContract = async (contractId: string) => {
  await apiClient.patch(`/contracts/${contractId}/reject`, {});
};

export const revokeContract = async (contractId: string) => {
  await apiClient.patch(`/contracts/${contractId}/revoke`, {});
};

export const deleteContract = async (contractId: string) => {
  await apiClient.delete(`/contracts/${contractId}`);
};

export const claimContractByToken = async (token: string) => {
  const response = await apiClient.post("/contracts/claim-by-token", { token });
  return ContractSchema.parse(response);
};
