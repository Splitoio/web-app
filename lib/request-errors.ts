// Turns a failed POST /api/requests into something a guest can act on.
//
// The backend's prose is written for an operator, not a consumer: the
// missing-trustline message alone carries the 56-char destination account AND
// the 56-char USDC issuer, and wrapped to eight lines in a toast. "/" is a
// no-account consumer surface (.specs/2026-08-06-request-money-design.md), so
// the headline here is our own short copy and the server's wording is demoted
// to a subordinate line with the long keys condensed out.
//
// Branch on `reason` — the machine-readable code the controller sends beside
// the message (request-money.controller.ts, `validateStellarDestination`) —
// never on the prose, which is free to change without notice.

/** Long base32/base58 blobs (Stellar account ids, asset issuers, Solana keys). */
const LONG_KEY = /\b[A-Za-z0-9]{32,}\b/g;

/** `GBBD47IF…LFLA5` — enough to recognise, short enough to read. */
export function condenseKeys(text: string): string {
  return text.replace(LONG_KEY, (k) => `${k.slice(0, 6)}…${k.slice(-4)}`);
}

export interface FormError {
  /** One short human sentence — the headline. Never raw server prose. */
  title: string;
  /** What to do about it, or the server's own wording, condensed. */
  detail?: string;
  /**
   * Set when the destination address itself is what's wrong, so the caller can
   * mark that input invalid instead of just showing a floating message.
   */
  field?: "destinationAddress";
}

/** snake_case reason -> "Snake case reason", for codes we haven't mapped yet. */
function humanizeReason(reason: string): string {
  const words = reason.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1) + ".";
}

/**
 * The create endpoint's unsupported-currency 400 (`Unsupported denomination
 * currency: <code>`, request-money.controller.ts) ships no `reason` field — the
 * only two the controller sends are the trustline pair below. Matching the
 * prose here is the one place we deliberately break the branch-on-code rule,
 * because there is no code to branch on and the bare message is a dead end.
 */
const UNSUPPORTED_CURRENCY_MESSAGE = /^unsupported denomination currency\b/i;

/**
 * `reason` codes the create endpoint can return today. Anything not listed
 * still degrades to a readable message via `humanizeReason` rather than
 * dumping prose — new backend codes do not need a client change to be safe.
 */
const BY_REASON: Record<string, FormError> = {
  missing_trustline: {
    title: "That Stellar address can't receive USDC yet.",
    detail:
      "The recipient needs to add a USDC trustline in their wallet, then you can create the link.",
    field: "destinationAddress",
  },
  account_not_found: {
    title: "That Stellar account isn't active yet.",
    detail:
      "A Stellar account has to be funded with XLM before it can receive anything.",
    field: "destinationAddress",
  },
  // No `field`: the address is fine, the *denomination currency* is the part
  // the user has to change. Pointing at destinationAddress would mark the one
  // input that isn't wrong. See the note above about where this code is
  // actually raised.
  unsupported_currency: {
    title: "We can't price requests in that currency yet.",
    detail: "Pick one of the supported currencies and the amount will convert on its own.",
  },
};

function readString(source: unknown, key: string): string | undefined {
  if (!source || typeof source !== "object") return undefined;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * `err` is the response interceptor's normalized error
 * ({ code, message, data }) — see api-helpers/client.ts. `data` is the raw
 * response body, which is where `reason` lives.
 */
export function toFormError(err: unknown): FormError {
  const code = typeof (err as { code?: unknown })?.code === "number" ? (err as { code: number }).code : 0;
  const message = readString(err, "message");
  const reason = readString((err as { data?: unknown })?.data, "reason");

  if (reason && BY_REASON[reason]) return BY_REASON[reason];

  if (message && UNSUPPORTED_CURRENCY_MESSAGE.test(message.trim())) {
    return BY_REASON.unsupported_currency;
  }

  // An unmapped reason: still readable, still specific, no raw prose headline.
  if (reason) {
    return {
      title: humanizeReason(reason),
      detail: message ? condenseKeys(message) : undefined,
      field: "destinationAddress",
    };
  }

  // No reason code. A 4xx message from this endpoint is already short and
  // user-facing ("Invalid stellar destination address", "expiresAt must be in
  // the future"), so it can be the headline once the long keys are condensed.
  if (code >= 400 && code < 500 && message) {
    return { title: condenseKeys(message) };
  }

  return {
    title: "Couldn't create your link.",
    detail: message ? condenseKeys(message) : "Please try again in a moment.",
  };
}
