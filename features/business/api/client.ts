import { apiClient } from "@/api-helpers/client";
import {
  RequestSchema,
  GroupBalanceSchema,
  GroupSchema,
  GroupUserSchema,
  UserSchema,
} from "@/api-helpers/modelSchema";
import { z } from "zod";

export const GetAllGroupsSchema = z.object({
  ...GroupSchema.shape,

  createdBy: z.object({
    id: z.string(),
    name: z.string(),
  }),
  groupBalances: z.array(GroupBalanceSchema).optional().default([]),
  groupUsers: z.array(z.any()).optional().default([]),
  expenses: z.array(RequestSchema).optional().default([]),
});

export const DetailGroupSchema = z.object({
  ...GroupSchema.shape,
  groupUsers: z.array(
    z.object({
      ...GroupUserSchema.shape,
      user: UserSchema,
    })
  ),
  expenses: z.array(RequestSchema),
  groupBalances: z.array(GroupBalanceSchema),
  createdBy: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

export type DetailOrganization = z.infer<typeof DetailGroupSchema>;

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

export type Invoice = z.infer<typeof InvoiceSchema>;

export const getAllOrganizations = async () => {
  const response = await apiClient.get("/groups", { params: { type: "BUSINESS" } });
  return GetAllGroupsSchema.array().parse(response);
};

export const createOrganization = async (payload: {
  name: string;
  description?: string;
  currency?: string;
  imageUrl?: string;
}) => {
  const response = await apiClient.post("/groups", { ...payload, type: "BUSINESS" });
  return GroupSchema.parse(response);
};

export const getOrganizationById = async (organizationId: string) => {
  const response = await apiClient.get(`/groups/${organizationId}`, { params: { type: "BUSINESS" } });
  return DetailGroupSchema.safeParse(response).data;
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

// Income received entries — fills the org treasury (admin only)
export const getStreamsByOrganization = async (organizationId: string) => {
  const response = await apiClient.get(`/groups/${organizationId}/streams`);
  return IncomeStreamSchema.array().parse(response);
};

export const createStream = async (
  organizationId: string,
  payload: { name: string; currency?: string; amount: number; description?: string | null; receivedDate?: string }
) => {
  const response = await apiClient.post(`/groups/${organizationId}/streams`, payload);
  return IncomeStreamSchema.parse(response);
};

export const updateStream = async (
  organizationId: string,
  streamId: string,
  payload: { name?: string; currency?: string; amount?: number; description?: string | null; receivedDate?: string }
) => {
  const response = await apiClient.put(`/groups/${organizationId}/streams/${streamId}`, payload);
  return IncomeStreamSchema.parse(response);
};

export const deleteStream = async (organizationId: string, streamId: string) => {
  await apiClient.delete(`/groups/${organizationId}/streams/${streamId}`);
};

// Contracts
export const ContractStatusSchema = z.enum(["DRAFT", "SENT", "REJECTED", "REVOKED"]);
export const ContractSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  createdById: z.string(),
  assignedToEmail: z.string(),
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
