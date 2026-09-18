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
  Steps,
  Strong,
  Table,
  UL,
} from "../../components";

const HREF = "/docs/api/conventions";

export const metadata = { title: "Conventions" };

export default function ConventionsPage() {
  return (
    <article>
      <PageHeader href={HREF} />

      <Lead>
        Everything on <Code>/api/v1</Code> answers in one of two shapes, fails with a code you can
        branch on, paginates the same way, and can be retried safely. Learn these once and no
        endpoint needs a special case.
      </Lead>

      <H2 id="envelope">The envelope</H2>

      <Pre label="single object">{`{ "data": { "id": "clw9req0001", "object": "request", "status": "OPEN" } }`}</Pre>

      <Pre label="list">{`{
  "data": [ { "id": "clw9req0001", "object": "request" } ],
  "pagination": { "limit": 25, "offset": 0, "total": 137, "hasMore": true }
}`}</Pre>

      <UL>
        <li>
          Every object carries an <Code>object</Code> discriminator (<Code>&quot;request&quot;</Code>,{" "}
          <Code>&quot;invoice&quot;</Code>, <Code>&quot;member&quot;</Code>, and so on), so a mixed
          payload can be dispatched on without inspecting keys.
        </li>
        <li>
          Every response carries <Code>Splito-Request-Id</Code>. Quote it in a support
          conversation.
        </li>
        <li>
          The first party endpoints under <Code>/api/*</Code> answer{" "}
          <Code>{`{ "error": "prose" }`}</Code> and are not changed by any of this.{" "}
          <Code>/api/v1</Code> is a separate, versioned surface precisely so it can have a contract
          worth committing to.
        </li>
      </UL>

      <H2 id="errors">Errors</H2>

      <Pre>{`{
  "error": {
    "code": "insufficient_scope",
    "message": "This API key is missing the \`invoices:write\` scope.",
    "details": { "required": "invoices:write", "granted": ["invoices:read"] },
    "requestId": "req_5f2a91c40b7e4d8a9c3b1e6f"
  }
}`}</Pre>

      <P_>
        <Strong>Branch on <Code>code</Code>, never on <Code>message</Code>.</Strong>
      </P_>

      <Table
        head={["Status", "Code", "Meaning"]}
        rows={[
          ["400", <Code>invalid_request</Code>, "Malformed body or bad query value. details carries the issues."],
          ["401", <Code>unauthenticated</Code>, "No Authorization header."],
          ["401", <Code>invalid_api_key</Code>, "Malformed token, unknown prefix, or wrong secret."],
          ["401", <Code>api_key_revoked</Code>, "Key was revoked or rotated away."],
          ["401", <Code>api_key_expired</Code>, "Key is past its expiresAt."],
          [
            "401",
            <Code>api_key_actor_inactive</Code>,
            "The member the key acts as left the workspace.",
          ],
          [
            "403",
            <Code>insufficient_scope</Code>,
            "Valid key, missing scope, or an action the API never permits.",
          ],
          [
            "404",
            <Code>not_found</Code>,
            "No such object in this workspace, or no such endpoint.",
          ],
          [
            "409",
            <Code>conflict</Code>,
            "Illegal state transition, duplicate invite, last owner guard.",
          ],
          ["409", <Code>idempotency_key_reused</Code>, "Same Idempotency-Key, different body."],
          ["409", <Code>idempotency_in_progress</Code>, "Same key, original still in flight."],
          ["429", <Code>rate_limited</Code>, "Over the per key ceiling. See Retry-After."],
          ["500", <Code>internal_error</Code>, "Our fault. Opaque on purpose; quote the requestId."],
          ["503", <Code>api_disabled</Code>, "The surface is switched off. Existing keys stay valid."],
        ]}
      />

      <Callout tone="note" title="404, not 403, across tenants">
        <p>
          An object that exists in another workspace answers <Code>404</Code>. A <Code>403</Code>{" "}
          there would let a caller enumerate ids across tenants.
        </p>
      </Callout>

      <H2 id="pagination">Pagination</H2>

      <UL>
        <li>
          Every list endpoint takes <Code>?limit=</Code> and <Code>?offset=</Code>.
        </li>
        <li>Default limit 25, maximum 100.</li>
        <li>A nonsensical limit or offset degrades to the default. It never 400s.</li>
        <li>
          <Code>pagination.hasMore</Code> is precomputed, so a loop needs no arithmetic.
        </li>
      </UL>

      <Pre>{`curl -s -H "Authorization: Bearer $SPLITO_KEY" \\
  "https://api.splito.io/api/v1/requests?limit=100&offset=100&status=OPEN"`}</Pre>

      <H2 id="idempotency">Idempotency</H2>

      <P_>
        Send <Code>Idempotency-Key</Code> (any unique string up to 255 characters) on a mutating
        request and a retry returns the original response instead of performing the write twice.
      </P_>

      <Pre>{`curl -X POST https://api.splito.io/api/v1/requests \\
  -H "Authorization: Bearer $SPLITO_KEY" \\
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \\
  -H "Content-Type: application/json" \\
  -d '{"amount":120,"denominationCurrency":"USD","destinationAsset":"usdc-stellar","destinationChain":"stellar","destinationAddress":"GA5...","payerCount":3}'`}</Pre>

      <Steps
        items={[
          {
            title: "Fingerprinting",
            body: (
              <p>
                The record stores a hash of method, path and canonical body. The same key with a
                different body is <Code>409 idempotency_key_reused</Code>, never a stale{" "}
                <Code>200</Code> that ignored the new body. Key order in JSON does not matter;
                array order does.
              </p>
            ),
          },
          {
            title: "Reservation",
            body: (
              <p>
                The record is inserted before the handler runs, so a concurrent duplicate loses the
                unique index race and gets <Code>409 idempotency_in_progress</Code> rather than
                executing in parallel.
              </p>
            ),
          },
          {
            title: "Only success is durable",
            body: (
              <p>
                A recorded 4xx or 5xx releases the key, so a retry after a failure gets a real
                attempt instead of a permanent copy of the failure.
              </p>
            ),
          },
          {
            title: "Records expire",
            body: <p>24 hours by default, then the key is free again.</p>,
          },
        ]}
      />

      <P_>
        A replayed response carries <Code>Splito-Idempotent-Replay: true</Code>.
      </P_>

      <H2 id="rate-limits">Rate limits</H2>

      <P_>Per key, per clock minute. Every response carries the state of your window.</P_>

      <Pre>{`X-RateLimit-Limit: 300
X-RateLimit-Remaining: 287
X-RateLimit-Reset: 1758193260`}</Pre>

      <P_>
        A <Code>429</Code> adds <Code>Retry-After</Code> in seconds. The default ceiling is 120
        requests a minute, settable per key when it is minted.
      </P_>

      <Callout tone="warn" title="What the number actually guarantees">
        <p>
          The counter lives in the process, and the backend runs on Lambda, so N warm execution
          environments enforce N independent windows and a key&apos;s real ceiling can be up to N
          times its limit. That is a deliberate trade: a shared counter would put a database write
          on the hot path of every call, to protect a limit whose job is stopping runaway clients
          rather than metering billing. Windows are aligned to the wall clock, so{" "}
          <Code>X-RateLimit-Reset</Code> means the same thing in every process.
        </p>
      </Callout>

      <P_>
        Next: <DocLink href="/docs/api/endpoints">every endpoint</DocLink>, with the scope each one
        costs.
      </P_>

      <Pager href={HREF} />
    </article>
  );
}
