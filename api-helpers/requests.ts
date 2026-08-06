// Typed client for the public "request money" payer API.
// Contract: .specs/2026-08-06-request-money-api-contract.md
//
// This module is the ONLY place that talks to the not-yet-built backend
// endpoints under /api/public/requests/*. Drops onto the real backend with
// no page/component changes once those routes exist.

import { apiClient } from "./client";

export type DestinationChain = "stellar" | "solana";
export type DestinationAsset = "usdc-stellar" | "usdc-solana";

export type RequestStatus = "OPEN" | "PARTIALLY_PAID" | "SETTLED" | "EXPIRED" | "CANCELLED";

export type RequestPayerStatus =
  | "PENDING"
  | "QUOTED"
  | "SUBMITTED"
  | "CONFIRMED"
  | "FAILED"
  | "EXPIRED";

export interface RequestPayerView {
  payerId: string;
  shareAmount: number;
  status: RequestPayerStatus;
}

export interface GetRequestResponse {
  requestId: string;
  /** null when the requester gave no description — the payer UI omits the line. */
  name: string | null;
  amount: number;
  denominationCurrency: "USD";
  destinationAsset: string;
  destinationChain: string;
  status: RequestStatus;
  expiresAt: string;
  requesterName: string | null;
  payers: RequestPayerView[];
  paidCount: number;
  totalCount: number;
}

export interface QuoteRequestBody {
  payerId: string;
  sourceAddress: string;
  sourceChain: string;
  sourceAsset: string;
}

export interface Quote {
  sourceAmount: string;
  destinationAmount: string;
  rate: number;
  route: string | null;
  fee: string | null;
}

export interface QuoteRequestResponse {
  paymentAttemptId: string;
  quote: Quote;
  quoteExpiry: string; // ISO datetime, server-computed. Never trust a client-side value.
  unsignedTx: string;
  chain: DestinationChain;
}

export interface SubmitRequestBody {
  paymentAttemptId: string;
  signedTx: string;
}

export type PaymentAttemptResult = "CONFIRMED" | "FAILED" | "STUCK";

export interface SubmitRequestResponse {
  status: PaymentAttemptResult;
  hash: string | null;
  paymentAttemptId: string;
}

export interface CreateRequestBody {
  amount: number;
  denominationCurrency: "USD";
  destinationAsset: DestinationAsset;
  destinationChain: DestinationChain;
  destinationAddress: string;
  payerCount: number;
  name?: string;
  expiresAt?: string;
}

export interface CreateRequestPayerLink {
  payerId: string;
  /** Decimal string, denomination currency (USD in v1) — per contract §1. */
  shareAmount: string;
  /** `${baseUrl}/pay/${token}?payer=${payerId}` — one link per payer, never
   * a single shared link, so the pay screen (which reads `?payer=`) always
   * knows unambiguously which payer opened it. */
  link: string;
}

export interface CreateRequestResponse {
  requestId: string;
  token: string;
  links: CreateRequestPayerLink[];
  expiresAt: string;
  status: "OPEN";
}

/**
 * POST /api/requests — session optional. If authenticated, the requester is
 * req.user; otherwise a shadow user is created/reused keyed by
 * destinationAddress. Never gated behind login — see
 * .specs/2026-08-06-request-money-design.md "Accounts".
 */
export async function createRequest(body: CreateRequestBody): Promise<CreateRequestResponse> {
  return apiClient.post(`/requests`, body);
}

// ─── The requester's own view (authenticated) ────────────────────────────────

export interface RequestListItem {
  id: string;
  /** null when the requester gave no description. */
  name: string | null;
  amount: number;
  denominationCurrency: string | null;
  destinationAsset: string | null;
  destinationChain: string | null;
  status: RequestStatus;
  expiresAt: string | null;
  createdAt: string;
  payerCount: number;
  paidCount: number;
  /** Sum of the shares already paid, in the denomination currency. */
  receivedAmount: number;
}

export interface ListRequestsResponse {
  requests: RequestListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface RequestDetailPayer {
  payerId: string;
  /** Positional label (1-based) — no payer names are ever collected. */
  index: number;
  shareAmount: number;
  isPaid: boolean;
  status: RequestPayerStatus;
  attemptStatus: string | null;
  transactionHash: string | null;
  /** Built server-side from the deployment's real network config. */
  explorerUrl: string | null;
  paidAt: string | null;
}

export interface RequestDetailResponse {
  id: string;
  name: string | null;
  amount: number;
  denominationCurrency: string | null;
  destinationAsset: string | null;
  destinationChain: string | null;
  destinationAddress: string | null;
  status: RequestStatus;
  expiresAt: string | null;
  createdAt: string;
  /** RequestLink token — rebuild links as `${origin}/pay/${token}?payer=${payerId}`. */
  token: string | null;
  payers: RequestDetailPayer[];
  payerCount: number;
  paidCount: number;
  receivedAmount: number;
}

/** GET /api/requests — authenticated. Requests created by the current user, newest first. */
export async function listRequests(params?: {
  limit?: number;
  offset?: number;
}): Promise<ListRequestsResponse> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return apiClient.get(`/requests${qs ? `?${qs}` : ""}`);
}

/** GET /api/requests/:id — authenticated, creator only (403 otherwise). */
export async function getRequestDetail(id: string): Promise<RequestDetailResponse> {
  return apiClient.get(`/requests/${encodeURIComponent(id)}`);
}

/** GET /api/public/requests/:token — public, no auth. */
export async function getRequestByToken(token: string): Promise<GetRequestResponse> {
  return apiClient.get(`/public/requests/${encodeURIComponent(token)}`);
}

/**
 * POST /api/public/requests/:token/quote — public, no auth.
 * Creates a NEW PaymentAttempt every call (no upsert/reuse — matches existing
 * settleDebtCreateTransaction behavior). quoteExpiry is server-computed
 * (now()+60s); never derive or override it client-side.
 */
export async function createRequestQuote(
  token: string,
  body: QuoteRequestBody
): Promise<QuoteRequestResponse> {
  return apiClient.post(`/public/requests/${encodeURIComponent(token)}/quote`, body);
}

/**
 * POST /api/public/requests/:token/submit — public, no auth.
 * Server rejects (400) if now() > quoteExpiry — re-quote via createRequestQuote
 * instead of retrying submit with a stale paymentAttemptId.
 */
export async function submitRequestPayment(
  token: string,
  body: SubmitRequestBody
): Promise<SubmitRequestResponse> {
  return apiClient.post(`/public/requests/${encodeURIComponent(token)}/submit`, body);
}
