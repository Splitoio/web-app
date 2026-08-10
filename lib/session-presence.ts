/**
 * Was a session cookie present when this page was served?
 *
 * The better-auth session cookie is httpOnly, so client code can never read it.
 * The server render CAN (app/layout.tsx → `hasSession`), and components/AuthProvider.tsx
 * publishes that answer here before any child query is mounted.
 *
 * This exists for exactly one decision, in api-helpers/client.ts's 401
 * interceptor: telling an ANONYMOUS VISITOR apart from an EXPIRED SESSION.
 * Both look identical at the HTTP layer — a 401 — but they mean opposite
 * things:
 *
 *   - no cookie ever  → the visitor is browsing the logged-out console and a
 *                       401 from a locked-feature query is the expected answer.
 *                       Bouncing them to /login would break the whole point.
 *   - cookie present  → they had a session and the server just rejected it.
 *                       That is a real expiry and must hard-redirect.
 *
 * Presence, never proof: the backend still authenticates every request. A
 * forged cookie only buys the forger a redirect to /login.
 */

let sessionPresent = false;

export function setSessionPresent(value: boolean): void {
  sessionPresent = value;
}

export function hasSessionPresence(): boolean {
  return sessionPresent;
}
