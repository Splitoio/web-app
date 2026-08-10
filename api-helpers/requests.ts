// Typed client for the public "request money" payer API.
// Contract: .specs/2026-08-06-request-money-api-contract.md
//
// This module is the ONLY place that talks to the not-yet-built backend
// endpoints under /api/public/requests/*. Drops onto the real backend with
// no page/component changes once those routes exist.

import { apiClient } from "./client";

export type DestinationChain = "stellar" | "solana";
// Four direct-path pairs (backend asset-config.ts): Stellar can receive native
// XLM or USDC; Solana can receive native SOL or USDC.
export type DestinationAsset = "xlm" | "usdc-stellar" | "sol" | "usdc-solana";

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
  /** The group member's profile name — null with no name/email on file, or
   * for an anonymous (payerCount) request. Visible to anyone with the link. */
  name: string | null;
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
  /** Set when the request was created against a group — null for the
   * anonymous payerCount flow. */
  group: { id: string; name: string } | null;
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

/** One named cost the payer pays, from the router. Contract §3 `quote.fees[]`. */
export interface QuoteFee {
  /** Stable machine key, e.g. "bridge-relayer", "gas", "pool-impact". */
  kind: string;
  /** Human label, ready to render as-is in the breakdown. */
  label: string;
  /** Decimal string in `asset` units. */
  amount: string;
  /** Internal asset id when it maps to one, else the provider's own symbol. */
  asset: string;
}

export interface Quote {
  sourceAmount: string;
  destinationAmount: string;
  rate: number;
  /**
   * Which rate `rate` actually is: true = the requester's Lock-1 rate stored
   * at request-creation time, false = a live fetch made just now (contract
   * change, request-money.controller.ts ~line 906). This is the server's own
   * verdict — never re-derive a rate-lock claim from `Request.timeLockIn`,
   * which stays true even when the stored rate turned out unusable and the
   * server fell back to a live quote.
   */
  rateLocked: boolean;
  /**
   * Human-readable route label; null on the direct path.
   *
   * NOT the direct-vs-routed test — use `isRouted`. The backend sets `route`
   * from the provider's own label, and a provider that returns an empty label
   * would make a routed payment look direct. `isRouted`/`isEstimate` are the
   * server's explicit statement of which path this is (contract §3, changed
   * 2026-08-07); `route` is display copy only.
   */
  route: string | null;
  /**
   * Headline bridge fee only, decimal string in destination-asset units, or
   * null. `fees` below is the real breakdown — prefer it and fall back to this
   * only when `fees` is empty.
   */
  fee: string | null;
  sourceAddress: string;
  sourceChain: string;
  sourceAsset: string;
  destinationChain: string;
  destinationAsset: string;

  // ── Routed-path fields (contract §3, ADDED 2026-08-07) ──────────────────
  /** false => no router was consulted at all. THE direct-vs-routed test. */
  isRouted: boolean;
  /** e.g. "allbridge". null on the direct path. */
  providerId: string | null;
  /** Full cost breakdown, shown BEFORE signing. [] when the provider reported
   * none — fees are NEVER synthesised when absent. */
  fees: QuoteFee[];
  /** Provider-reported bounds on what lands; null when it did not report them.
   * When present, `destinationAmountMin` is the honest worst case — do not
   * compute one from the slippage band on top of it. */
  destinationAmountMin: string | null;
  destinationAmountMax: string | null;
  /** Provider's own end-to-end estimate, ms. null when not reported. */
  estimatedTimeMs: number | null;
  /**
   * TRUE on every routed payment. Allbridge Core (and every router checked)
   * exposes CALCULATION endpoints only — no reservable quote, no validity
   * window. The UI must NEVER present a routed `destinationAmount` as
   * guaranteed, and must never write "exactly" when this is true.
   */
  isEstimate: boolean;
  /** The config-capped band we commit to (50 = ±0.5%). null on the direct
   * path, which is exact. */
  slippageBps: number | null;
  /**
   * ADDED 2026-08-07 (`.specs/2026-08-07-router-alternatives.md`). Present on
   * exact-output same-chain conversions (Stellar path payment `sendMax`,
   * Jupiter `otherAmountThreshold`) — `isRouted: true` with `isEstimate:
   * false`. This is the payer's ceiling, not a guess: the protocol enforces it
   * on-chain (the tx reverts rather than exceeding it), so it is the number
   * the payer actually commits to. null on every other path — degrade to
   * `sourceAmount` rather than rendering a placeholder.
   */
  sourceAmountMax: string | null;
}

/** One transaction the payer must sign, in ARRAY ORDER (contract §3). */
export interface UnsignedTransaction {
  /**
   * "approve" (EVM allowance) and "swap" are preparation legs; "transfer" is
   * ALWAYS the funds-delivering leg and the one `submit` tracks.
   *
   * "swap" (ADDED 2026-08-07, contract §3) is Jupiter's ExactOut transaction —
   * it converts inside the PAYER'S OWN wallet (payer -> payer), so it does not
   * move funds to the recipient. It is followed by a "transfer" leg (an
   * ordinary SPL/SOL transfer of the exact destination amount, payer ->
   * recipient). Both legs are signed AND broadcast by the client on Solana
   * (contract §0.2) — the hash reported to the backend is the "transfer"
   * leg's, never the "swap" leg's.
   */
  kind: "approve" | "swap" | "transfer";
  /** The SOURCE chain for a routed payment. */
  chain: string;
  /** Encoding depends on the chain family — the wallet layer branches on `chain`. */
  payload: string;
}

export interface QuoteRequestResponse {
  paymentAttemptId: string;
  quote: Quote;
  quoteExpiry: string; // ISO datetime, server-computed. Never trust a client-side value.
  unsignedTx: string;
  /**
   * null on the direct path. On the routed path the payer signs these IN
   * ORDER — there may be more than one (contract §3, ADDED 2026-08-07).
   */
  unsignedTransactions: UnsignedTransaction[] | null;
  /**
   * The chain the payer's WALLET signs on: destinationChain when direct, the
   * SOURCE chain when routed (contract §3, CHANGED 2026-08-07). This — not the
   * request's destination chain — is what selects the wallet adapter.
   */
  chain: string;
  /** Mirrors `quote.isRouted`. */
  isRouted: boolean;
}

export interface SubmitRequestBody {
  paymentAttemptId: string;
  signedTx: string;
}

/**
 * Contract §4, CHANGED 2026-08-07. Submit NEVER returns STUCK any more.
 *  - CONFIRMED — direct path only, funds are at the destination, terminal.
 *  - FAILED    — terminal, returned with HTTP 200 so the pay screen renders it.
 *  - ROUTING   — routed path: broadcast on the SOURCE chain, nothing settled.
 *                Poll `statusUrl` (§5). STUCK can only come from that poll.
 */
export type SubmitStatus = "CONFIRMED" | "FAILED" | "ROUTING";

export interface SubmitRequestResponse {
  status: SubmitStatus;
  /** Direct: destination tx hash. Routed: SOURCE-chain tx id. */
  hash: string | null;
  paymentAttemptId: string;
  /** Routed only — the §5 path to poll. */
  statusUrl?: string;
  /** Routed only — payer-facing explanation, ready to render. */
  message?: string;
  /** Present when status === "FAILED". */
  error?: string;
}

/**
 * Raw PaymentAttempt state machine value (contract §5).
 * CONFIRMED = direct-path success. DELIVERED = routed success. Render both as paid.
 */
export type PaymentAttemptState =
  | "QUOTED"
  | "SIGNED"
  | "BROADCAST"
  | "ROUTING"
  | "DELIVERED"
  | "CONFIRMED"
  | "FAILED"
  | "STUCK";

export interface PublicPaymentAttemptResponse {
  paymentAttemptId: string;
  status: PaymentAttemptState;
  isRouted: boolean;
  route: string | null;
  providerId: string | null;
  /** What the payer broadcast. */
  sourceTxHash: string | null;
  /** Set once the provider reports delivery. */
  destinationTxHash: string | null;
  /** Built from SERVER network config — never guessed client-side. */
  explorerUrl: string | null;
  sourceAmount: string | null;
  quotedDestinationAmount: string | null;
  /** true on routed — the quoted number was never guaranteed. */
  isEstimate: boolean;
  slippageBps: number | null;
  /** Set ONLY when delivery landed outside the band; the share is then NOT
   * settled and the request is PARTIALLY_PAID. */
  shortfall: string | null;
  lastCheckedReason: string | null;
  createdAt: string;
  completedAt: string | null;
  /** Non-null only while status === "STUCK". Copy is server-owned. */
  recovery: null | { stuck: true; message: string; contact: string };
}

export interface CreateRequestBody {
  amount: number;
  denominationCurrency: "USD";
  destinationAsset: DestinationAsset;
  destinationChain: DestinationChain;
  destinationAddress: string;
  /**
   * Exactly ONE of `payerCount` or `groupId` — never both, never neither
   * (the backend 400s either violation). `payerCount` (1..50) is the
   * anonymous flow with no named payers. `groupId` requests from every OTHER
   * member of that group (the requester is always excluded from the
   * payers) — 401 signed-out, 404 unknown group, 403 not a member, 400 a
   * group with no other members.
   */
  payerCount?: number;
  groupId?: string;
  name?: string;
  expiresAt?: string;
  /** Scope to a BUSINESS workspace instead of the requester's personal
   * context. Omit (or "personal") for personal — see request-money.controller.ts. */
  workspaceId?: string;
  /** Lock the fiat->asset rate at CREATION time (Lock 1 of the two-lock model).
   * Omitting this does NOT mean "unlocked" — the backend falls back to the
   * caller's User.timeLockInDefault (createRequestSchema, request-money.controller.ts),
   * which is false for a fresh account. Always send the toggle's actual value so
   * the request stores what the requester was shown. */
  timeLockIn?: boolean;
}

export interface CreateRequestPayerLink {
  payerId: string;
  /** The group member's profile name — null when they have no name/email on
   * file, or always null for the anonymous `payerCount` flow. Falls back to
   * the positional index in the UI exactly like an anonymous payer does. */
  name: string | null;
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
  /** Set when created via `groupId` — null for the anonymous `payerCount` flow. */
  group: { id: string; name: string } | null;
  /** Equals `links.length` — the actual payer count. In group mode this is
   * members-minus-the-requester, so it can differ from the group's member
   * count; always trust this over any locally-derived guess. */
  payerCount: number;
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
  /** null = the requester's personal context. */
  workspaceId: string | null;
  status: RequestStatus;
  expiresAt: string | null;
  createdAt: string;
  payerCount: number;
  paidCount: number;
  /** Sum of the shares already paid, in the denomination currency. */
  receivedAmount: number;
  /** Set when created via `groupId` — null for the anonymous payerCount flow. */
  group: { id: string; name: string } | null;
}

export interface ListRequestsResponse {
  requests: RequestListItem[];
  total: number;
  limit: number;
  offset: number;
  /** The scope the server actually applied — null for personal. */
  workspaceId: string | null;
}

export interface RequestDetailPayer {
  payerId: string;
  /** Positional label (1-based) — the fallback when `name` is null (an
   * anonymous payer, or a group member with no name/email on file). */
  index: number;
  /** The group member's profile name, or null — see `index` for the fallback. */
  name: string | null;
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
  /** null = personal request. Set when the request belongs to a business
   * workspace — the detail endpoint authorises owner OR workspace member. */
  workspaceId: string | null;
  /** Set when created via `groupId` — null for the anonymous payerCount flow. */
  group: { id: string; name: string } | null;
  payers: RequestDetailPayer[];
  payerCount: number;
  paidCount: number;
  receivedAmount: number;
}

/**
 * GET /api/requests — authenticated. Requests created by the current user,
 * newest first. `workspaceId` scopes the list to a business workspace; the
 * server also accepts the literal "personal" as a synonym for the personal
 * scope, so the active workspace id can be passed through unconditionally.
 */
export async function listRequests(params?: {
  limit?: number;
  offset?: number;
  workspaceId?: string;
}): Promise<ListRequestsResponse> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  if (params?.workspaceId != null) search.set("workspaceId", params.workspaceId);
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

export interface SupportedSource {
  chain: string;
  asset: string;
}

export interface SupportedSourcesResponse {
  sources: SupportedSource[];
}

/**
 * GET /api/public/requests/:token/sources — public, no auth. Contract §2b.
 *
 * The set of (chain, asset) pairs THIS request will accept as a SOURCE, i.e.
 * what the payer may pay WITH. Distinct from the destination pair, which is
 * fixed at creation and immutable.
 *
 * Server-derived and request-specific: the direct pair is always first, and
 * routed pairs appear only when the routing kill switch is on AND the live
 * router confirms it supports both legs. It is therefore authoritative in a
 * way no client-side list can be — with routing off it correctly returns the
 * direct pair alone, which is exactly what `quoteRequest` will accept.
 */
export async function getSupportedSources(token: string): Promise<SupportedSourcesResponse> {
  return apiClient.get(`/public/requests/${encodeURIComponent(token)}/sources`);
}

/**
 * GET /api/public/requests/:token/attempts/:paymentAttemptId — public, no auth.
 * Contract §5.
 *
 * The attempt-level status surface. This — not the request-level GET — is what
 * a routed payment polls after submit returns ROUTING, and it is the only
 * place STUCK and its `recovery` copy come from.
 */
export async function getPaymentAttempt(
  token: string,
  paymentAttemptId: string
): Promise<PublicPaymentAttemptResponse> {
  return apiClient.get(
    `/public/requests/${encodeURIComponent(token)}/attempts/${encodeURIComponent(paymentAttemptId)}`
  );
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
