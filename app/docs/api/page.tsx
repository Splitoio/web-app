import {
  Callout,
  Code,
  DocLink,
  H2,
  H3,
  Lead,
  P_,
  PageHeader,
  Pager,
  Pre,
  Strong,
  Table,
  UL,
} from "../components";

const HREF = "/docs/api";

export const metadata = { title: "Business API" };

export default function ApiPage() {
  return (
    <article>
      <PageHeader href={HREF} />

      <Lead>
        The Business API is a versioned, server to server surface at{" "}
        <Code>https://server.splito.io/api/v1</Code>. A key belongs to exactly one workspace and
        carries scopes; the workspace is never a request parameter, so a key cannot reach past the
        business it was minted in.
      </Lead>

      <H2 id="keys">Minting a key</H2>

      <P_>
        Keys are created with your dashboard session, not with another key: minting a credential
        requires a human, and a key can never issue or widen another one. Owner and admin only.
      </P_>

      <Pre label="create a key">{`curl -X POST https://server.splito.io/api/organizations/<organizationId>/api-keys \\
  -H 'Content-Type: application/json' \\
  --cookie "$SPLITO_SESSION_COOKIE" \\
  -d '{
    "name": "Billing sync",
    "scopes": ["invoices:write", "treasury:read"],
    "expiresInDays": 365,
    "rateLimitPerMin": 120
  }'`}</Pre>

      <P_>
        The response is the only place the token ever appears in full. It looks like{" "}
        <Code>spl_sk_&lt;prefix&gt;_&lt;secret&gt;</Code>: the prefix is stored so a request is one
        indexed lookup, the secret is stored only as a salted hash. There is no way to read it back
        later, so losing it means rotating.
      </P_>

      <Table
        head={["Operation", "Endpoint"]}
        rows={[
          ["Create", <Code>POST /api/organizations/:organizationId/api-keys</Code>],
          ["List, including revoked", <Code>GET /api/organizations/:organizationId/api-keys</Code>],
          ["Rotate", <Code>POST /api/organizations/:organizationId/api-keys/:keyId/rotate</Code>],
          ["Rename, rescope", <Code>PATCH /api/organizations/:organizationId/api-keys/:keyId</Code>],
          ["Revoke", <Code>DELETE /api/organizations/:organizationId/api-keys/:keyId</Code>],
        ]}
      />

      <Callout tone="gap" title="No key screen in the dashboard yet">
        <p>
          Key management has endpoints but no UI. Until it lands, mint keys with the calls above,
          using the session cookie from a signed-in browser.
        </p>
      </Callout>

      <H2 id="auth">Authenticating</H2>

      <Pre label="every call">{`curl https://server.splito.io/api/v1/ping \\
  -H 'Authorization: Bearer spl_sk_xxxxxxxxxxxxxxxx_yyyyyyyyyyyyyyyyyyyyyyyy'`}</Pre>

      <P_>
        <Code>GET /api/v1/ping</Code> and <Code>GET /api/v1/meta</Code> need a valid key but no
        scope, so a narrowly scoped key can still prove itself. A bad prefix, a bad secret and a
        malformed header all answer the same <Code>401 invalid_api_key</Code>, on purpose.
      </P_>

      <H3>Scopes</H3>

      <P_>
        Write implies read, per resource: <Code>invoices:write</Code> also grants{" "}
        <Code>invoices:read</Code>, and says nothing about treasury. <Code>requests:*</Code> takes
        a whole resource; <Code>*</Code> takes everything, including scopes added later.
      </P_>

      <Table
        head={["Scope", "Grants"]}
        rows={[
          ["organization:read", "The workspace profile, its settings and its member count."],
          ["dashboard:read", "The aggregated dashboard summary."],
          ["members:read", "List members and pending invites."],
          ["members:write", "Invite people, revoke invites, change roles."],
          ["requests:read", "List and read money requests, payers and links."],
          ["requests:write", "Create and cancel money requests."],
          ["invoices:read", "List and read invoices."],
          ["invoices:write", "Create invoices and move them through their lifecycle."],
          ["treasury:read", "Read income streams and treasury expenses."],
          ["treasury:write", "Record, edit and delete treasury entries."],
          ["contracts:read", "List and read contracts."],
          ["activity:read", "Read the workspace activity feed."],
          ["webhooks:read", "List endpoints and inspect delivery attempts."],
          ["webhooks:write", "Create, edit, disable and delete endpoints."],
        ]}
      />

      <H2 id="shape">Request and response shape</H2>

      <Pre label="success">{`{
  "data": { "id": "cmu6...", "status": "SENT", "amount": 3400, "currency": "USD" }
}

// list responses add pagination
{
  "data": [ ... ],
  "pagination": { "limit": 50, "offset": 0, "total": 214, "hasMore": true }
}`}</Pre>

      <Pre label="failure">{`{
  "error": {
    "code": "insufficient_scope",
    "message": "This key does not carry invoices:write.",
    "requestId": "req_01J9..."
  }
}`}</Pre>

      <UL>
        <li>
          Branch on <Code>error.code</Code>, never on the message. The codes are{" "}
          <Code>unauthenticated</Code>, <Code>invalid_api_key</Code>, <Code>api_key_revoked</Code>,{" "}
          <Code>api_key_expired</Code>, <Code>api_key_actor_inactive</Code>,{" "}
          <Code>insufficient_scope</Code>, <Code>invalid_request</Code>, <Code>not_found</Code>,{" "}
          <Code>conflict</Code>, <Code>idempotency_key_reused</Code>,{" "}
          <Code>idempotency_in_progress</Code>, <Code>rate_limited</Code>,{" "}
          <Code>internal_error</Code> and <Code>api_disabled</Code>.
        </li>
        <li>
          <Code>requestId</Code> is on every response including 401s. Quote it in a support
          request.
        </li>
        <li>
          Paginate with <Code>limit</Code> and <Code>offset</Code>. The ceiling is 100 per page.
        </li>
        <li>
          Rate limits are per key, 120 requests a minute by default, reported on every response as{" "}
          <Code>X-RateLimit-Limit</Code>, <Code>X-RateLimit-Remaining</Code> and{" "}
          <Code>X-RateLimit-Reset</Code>.
        </li>
      </UL>

      <H3>Idempotency</H3>

      <P_>
        Send <Code>Idempotency-Key</Code> on any write and the response is recorded against it for
        24 hours. A retry with the same key replays the original response instead of creating a
        second invoice. Reusing a key against a different endpoint or body is a conflict rather
        than a silent replay.
      </P_>

      <Pre label="safe retry">{`curl -X POST https://server.splito.io/api/v1/invoices \\
  -H 'Authorization: Bearer spl_sk_...' \\
  -H 'Idempotency-Key: invoice-2026-09-harbourline-0042' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "amount": 3400,
    "currency": "USD",
    "dueDate": "2026-09-30T00:00:00.000Z",
    "description": "Illustration set, Kestrel Health"
  }'`}</Pre>

      <H2 id="endpoints">What you can call</H2>

      <Table
        head={["Area", "Endpoints", "Scope"]}
        rows={[
          [
            "Discovery",
            <>
              <Code>GET /ping</Code>, <Code>GET /meta</Code>
            </>,
            "none",
          ],
          ["Dashboard", <Code>GET /dashboard/summary</Code>, "dashboard:read"],
          ["Workspace", <Code>GET /organization</Code>, "organization:read"],
          [
            "Members",
            <>
              <Code>GET /members</Code>, <Code>PATCH /members/:userId</Code>,{" "}
              <Code>DELETE /members/:userId</Code>
            </>,
            "members:read / write",
          ],
          [
            "Invites",
            <>
              <Code>GET /invites</Code>, <Code>POST /invites</Code>,{" "}
              <Code>POST /invites/:id/revoke</Code>
            </>,
            "members:read / write",
          ],
          [
            "Requests",
            <>
              <Code>GET /requests</Code>, <Code>POST /requests</Code>,{" "}
              <Code>GET /requests/:id</Code>, <Code>POST /requests/:id/cancel</Code>
            </>,
            "requests:read / write",
          ],
          [
            "Invoices",
            <>
              <Code>GET /invoices</Code>, <Code>POST /invoices</Code>,{" "}
              <Code>GET /invoices/:id</Code>, <Code>PATCH /invoices/:id</Code>
            </>,
            "invoices:read / write",
          ],
          [
            "Treasury",
            <>
              <Code>/treasury/income-streams</Code> and <Code>/treasury/expenses</Code>, each with
              list, create, patch and delete
            </>,
            "treasury:read / write",
          ],
          [
            "Contracts",
            <>
              <Code>GET /contracts</Code>, <Code>GET /contracts/:id</Code> (read only)
            </>,
            "contracts:read",
          ],
          ["Activity", <Code>GET /activity</Code>, "activity:read"],
          [
            "Webhooks",
            <>
              <Code>/webhooks</Code>, <Code>/webhooks/:id</Code>,{" "}
              <Code>/webhooks/:id/rotate-secret</Code>, <Code>/webhooks/:id/test</Code>,{" "}
              <Code>/webhooks/deliveries</Code>
            </>,
            "webhooks:read / write",
          ],
        ]}
      />

      <P_>
        Invoice status moves follow the same table the dashboard obeys, so{" "}
        <Code>PATCH /invoices/:id</Code> with an illegal target is refused with the reason. See{" "}
        <DocLink href="/docs/invoices">Invoices and approvals</DocLink>.
      </P_>

      <H2 id="webhooks">Webhooks</H2>

      <P_>
        Register a URL, subscribe to event types, and Splito posts a signed JSON body when
        something happens. Subscribe to <Code>*</Code> for everything, or{" "}
        <Code>invoice.*</Code> for a whole resource so a new status does not need a redeploy.
      </P_>

      <Pre label="the body">{`{
  "id": "evt_...",
  "type": "invoice.approved",
  "createdAt": "2026-09-18T09:14:02.511Z",
  "organizationId": "cmu6...",
  "apiVersion": "v1",
  "data": { ... }
}`}</Pre>

      <H3>Events</H3>

      <Table
        head={["Event", "Fires when"]}
        rows={[
          ["request.created", "A money request was created in this workspace."],
          ["request.partially_paid", "At least one payer, but not all, has paid."],
          ["request.settled", "Every payer has paid their share."],
          ["request.cancelled", "The request was cancelled."],
          ["request.expired", "The request passed its expiry unsettled."],
          ["invoice.created", "An invoice was raised."],
          ["invoice.sent", "An invoice was sent to its recipient."],
          ["invoice.approved", "An invoice was approved."],
          ["invoice.declined", "An invoice was declined."],
          ["invoice.paid", "An invoice was marked paid."],
          ["invoice.overdue", "An invoice passed its due date unpaid."],
          ["invoice.cleared", "An invoice was cleared end to end."],
          ["invoice.cancelled", "An invoice was cancelled."],
          ["invite.created", "Someone was invited to the workspace."],
          ["invite.accepted", "An invite was accepted. member.joined follows."],
          ["invite.declined", "An invite was declined."],
          ["invite.revoked", "An invite was revoked before it was used."],
          ["member.joined", "A member took a seat."],
          ["treasury.income.recorded", "An income stream was recorded."],
          ["treasury.expense.recorded", "A treasury expense was recorded."],
          ["webhook.test", "You asked for a test event."],
        ]}
      />

      <H3>Verifying the signature</H3>

      <P_>
        Every delivery carries <Code>Splito-Signature: t=&lt;unix seconds&gt;,v1=&lt;hex&gt;</Code>
        , along with <Code>Splito-Event-Id</Code>, <Code>Splito-Event-Type</Code> and{" "}
        <Code>Splito-Delivery-Attempt</Code>. The signed string is the timestamp, a full stop, then
        the raw body, so a captured request cannot be replayed later without breaking the
        signature. Look up <Code>v1</Code> by name rather than by position.
      </P_>

      <Pre label="node">{`import { createHmac, timingSafeEqual } from "crypto";

export function verify(rawBody, header, secret, toleranceSeconds = 300) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=")));
  const t = Number.parseInt(parts.t, 10);
  if (!Number.isFinite(t) || !parts.v1) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(parts.v1, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}`}</Pre>

      <Callout tone="warn" title="Verify against the raw body">
        <p>
          Parse the JSON after you have verified, not before. Re-serialising changes the bytes and
          the signature will not match.
        </p>
      </Callout>

      <H3>Retries</H3>

      <UL>
        <li>2xx is success. Everything else is retried, including 404 and 410.</li>
        <li>
          Eight attempts, backing off 30 seconds, 1 minute, 2, 4, and so on up to an hour: a little
          over four hours in total.
        </li>
        <li>
          An endpoint that fails 20 times in a row is disabled, and stays disabled until you
          re-enable it.
        </li>
        <li>
          The event id is stable across retries, so deduplicate on{" "}
          <Code>Splito-Event-Id</Code>. Delivery is at least once.
        </li>
        <li>
          <Code>POST /webhooks/:id/test</Code> sends <Code>webhook.test</Code> to that endpoint
          whether or not it subscribed to it, which is how you prove the URL and the signature
          before the subscription list is right.
        </li>
      </UL>

      <Callout tone="note" title="Both surfaces have a kill switch">
        <p>
          If the API is turned off, every <Code>/api/v1</Code> route answers{" "}
          <Code>503 api_disabled</Code> while key management keeps working, so keys stay revocable.
          Webhooks have their own switch. Neither is something you can set yourself: ask support if
          you see a 503 that does not clear.
        </p>
      </Callout>

      <Pager href={HREF} />
    </article>
  );
}
