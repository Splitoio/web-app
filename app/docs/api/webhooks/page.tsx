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
} from "../../components";

const HREF = "/docs/api/webhooks";

export const metadata = { title: "Webhooks" };

export default function WebhooksPage() {
  return (
    <article>
      <PageHeader href={HREF} />

      <Lead>
        Register a URL, subscribe to event types, and Splito posts a signed JSON body when
        something in the workspace changes. Events are detected by watching the data, not by
        emitting from a controller, which is why nothing can forget to fire one.
      </Lead>

      <H2 id="detection">How events are detected</H2>

      <P_>
        Every table that sources an event carries a watermark column: the state that row was last
        reported to subscribers as. A dispatch pass looks for rows whose real state has drifted
        from their watermark, queues a delivery per subscribed endpoint, and advances the
        watermark.
      </P_>

      <UL>
        <li>
          <Strong>Events fire no matter who made the change.</Strong> The web app, the iOS app,
          this API and a manual SQL fix all move the same rows.
        </li>
        <li>
          <Strong>No webhook write happens inside a money transaction.</Strong> Settlement runs in
          a Postgres transaction, where a failed insert poisons the whole thing.
        </li>
        <li>
          <Strong>Passes are safe to run concurrently.</Strong> Event ids are derived from
          endpoint, type, subject and state, and the column is unique, so two overlapping passes
          produce one delivery.
        </li>
      </UL>

      <Callout tone="warn" title="The costs, stated plainly">
        <p>
          Detection runs on a cadence, so latency is up to the dispatch interval, 60 seconds by
          default. Read <Code>meta.webhooks.detectionIntervalSeconds</Code> for the live value. A
          row that moves through two states between passes reports only the later one. For
          anything needing sub-second latency, poll the API instead.
        </p>
      </Callout>

      <P_>
        Registering an endpoint starts from now. Watermarks advance even when nothing is
        subscribed, so a new endpoint never replays a workspace&apos;s history.
      </P_>

      <H2 id="events">Event types</H2>

      <Table
        head={["Type", "Meaning"]}
        rows={[
          [<Code>request.created</Code>, "A money request was created in this workspace."],
          [<Code>request.partially_paid</Code>, "At least one payer, but not all, has paid."],
          [<Code>request.settled</Code>, "Every payer has paid their share."],
          [<Code>request.cancelled</Code>, "The request was cancelled."],
          [<Code>request.expired</Code>, "The request passed its expiry unsettled."],
          [<Code>invoice.created</Code>, "An invoice was raised."],
          [<Code>invoice.sent</Code>, "An invoice was sent to its recipient."],
          [<Code>invoice.approved</Code>, "An invoice was approved."],
          [<Code>invoice.declined</Code>, "An invoice was declined."],
          [<Code>invoice.paid</Code>, "An invoice was marked paid."],
          [<Code>invoice.overdue</Code>, "An invoice passed its due date unpaid."],
          [<Code>invoice.cleared</Code>, "An invoice was cleared end to end."],
          [<Code>invoice.cancelled</Code>, "An invoice was cancelled."],
          [<Code>invite.created</Code>, "Someone was invited to the workspace."],
          [
            <Code>invite.accepted</Code>,
            <>
              An invite was accepted. <Code>member.joined</Code> follows for the seat itself.
            </>,
          ],
          [<Code>invite.declined</Code>, "An invite was declined."],
          [<Code>invite.revoked</Code>, "An invite was revoked before use."],
          [<Code>member.joined</Code>, "A member took a seat."],
          [<Code>treasury.income.recorded</Code>, "An income stream was recorded."],
          [<Code>treasury.expense.recorded</Code>, "A treasury expense was recorded."],
          [
            <Code>webhook.test</Code>,
            <>
              A test event, from <Code>POST /webhooks/:id/test</Code>.
            </>,
          ],
        ]}
      />

      <P_>
        Subscribe with exact types, <Code>resource.*</Code>, or <Code>*</Code> which includes types
        added later. <Code>member.removed</Code> does not exist: the row is gone, so a watermark
        sweep cannot see it. Poll <Code>GET /members</Code> if you need that.
      </P_>

      <H2 id="payload">The payload</H2>

      <Pre>{`{
  "id": "evt_9f14c8a2b7e34d1a8c0b6e2f5a3d7c91",
  "type": "request.settled",
  "createdAt": "2026-09-18T12:00:03.412Z",
  "organizationId": "clv7org0001",
  "apiVersion": "v1",
  "data": { "request": { "id": "clw9req0001", "object": "request", "status": "SETTLED" } }
}`}</Pre>

      <P_>
        <Code>data</Code> holds the same object shape the REST endpoints return, so a parser
        written for the API works on a webhook unchanged. The key inside <Code>data</Code> follows
        the event family: <Code>request</Code>, <Code>invoice</Code>, <Code>invite</Code>,{" "}
        <Code>member</Code>, <Code>incomeStream</Code>, <Code>expense</Code>. See the{" "}
        <DocLink href="/docs/api/objects">object reference</DocLink>.
      </P_>

      <Table
        head={["Header", "Value"]}
        rows={[
          [<Code>Splito-Signature</Code>, <Code>t=&lt;unix&gt;,v1=&lt;hex hmac&gt;</Code>],
          [
            <Code>Splito-Event-Id</Code>,
            <>
              Stable per event and endpoint. <Strong>Deduplicate on this.</Strong>
            </>,
          ],
          [<Code>Splito-Event-Type</Code>, "The event type, also in the body."],
          [<Code>Splito-Delivery-Attempt</Code>, "1-based attempt counter."],
          [<Code>User-Agent</Code>, <Code>Splito-Webhooks/1.0</Code>],
        ]}
      />

      <H2 id="verify">Verifying a signature</H2>

      <P_>
        The signed string is <Code>&lt;timestamp&gt;.&lt;raw request body&gt;</Code>, HMAC-SHA256
        with your endpoint secret, hex encoded. The timestamp is inside the signed string, which is
        what makes replay detectable: a captured request cannot be moved forward in time without
        invalidating the signature. Signing the body alone would leave a capture valid forever.
      </P_>

      <Callout tone="warn" title="Verify against the raw body">
        <p>
          Before any JSON parsing or re-serialisation. If your framework has already parsed and
          re-serialised the payload, the bytes differ and no amount of correct secret will help.
        </p>
      </Callout>

      <Pre label="node">{`const crypto = require("crypto");

function verifySplitoWebhook(rawBody, header, secret, toleranceSeconds = 300) {
  const parts = new Map(header.split(",").map((p) => p.trim().split("=")));
  const t = Number.parseInt(parts.get("t"), 10);
  const v1 = parts.get("v1");
  if (!Number.isFinite(t) || !v1) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > toleranceSeconds) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(\`\${t}.\${rawBody}\`)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(v1, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Express: capture the raw body for this route only.
app.post("/splito/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const ok = verifySplitoWebhook(
    req.body.toString("utf8"),
    req.get("Splito-Signature"),
    process.env.SPLITO_WEBHOOK_SECRET
  );
  if (!ok) return res.status(400).send("bad signature");

  const event = JSON.parse(req.body.toString("utf8"));
  // Respond 2xx fast, do the work asynchronously.
  res.status(204).end();
});`}</Pre>

      <P_>
        <Code>v1</Code> is a version tag so a future scheme can be added alongside it. Look it up
        in the header rather than assuming its position.
      </P_>

      <H2 id="retries">Retries and failure</H2>

      <UL>
        <li>
          <Strong>2xx is success, everything else retries</Strong>, including 4xx. A consumer
          answering 404 or 410 is usually mid-deploy or mis-routed, and the failure that actually
          costs an integrator money is the event dropped because their server was briefly wrong.
        </li>
        <li>
          Backoff is 30s, 1m, 2m, 4m and so on, capped at an hour. Eight attempts span a little
          over four hours: long enough to ride out a deploy, short enough that you are not
          receiving yesterday&apos;s events.
        </li>
        <li>
          Out of attempts a delivery is <Code>EXHAUSTED</Code>. Requeue it with{" "}
          <Code>POST /webhooks/deliveries/:id/retry</Code>.
        </li>
        <li>
          After 20 consecutive failures the endpoint is auto-disabled; any success resets the
          counter. A disabled endpoint&apos;s queued deliveries are held, not burned, so
          re-enabling resumes the backlog.
        </li>
        <li>
          <Strong>Delivery is at least once.</Strong> A pass that posts and then dies before
          recording the outcome will retry. Key off <Code>Splito-Event-Id</Code>.
        </li>
        <li>Redirects are not followed and your response body is not read.</li>
        <li>
          <Code>SUCCEEDED</Code> deliveries are pruned after 7 days, so the delivery log is recent
          history rather than an archive.
        </li>
      </UL>

      <H2 id="endpoints">Managing endpoints</H2>

      <Table
        head={["Endpoint", "Scope", "Notes"]}
        rows={[
          [<Code>GET /webhooks</Code>, <Code>webhooks:read</Code>, ""],
          [
            <Code>POST /webhooks</Code>,
            <Code>webhooks:write</Code>,
            <Code>{`{ url, events, description? }`}</Code>,
          ],
          [<Code>GET /webhooks/:endpointId</Code>, <Code>webhooks:read</Code>, ""],
          [
            <Code>PATCH /webhooks/:endpointId</Code>,
            <Code>webhooks:write</Code>,
            <Code>{`{ url?, events?, description?, enabled? }`}</Code>,
          ],
          [
            <Code>DELETE /webhooks/:endpointId</Code>,
            <Code>webhooks:write</Code>,
            "Cascades its deliveries.",
          ],
          [
            <Code>POST /webhooks/:endpointId/rotate-secret</Code>,
            <Code>webhooks:write</Code>,
            "Takes effect immediately.",
          ],
          [
            <Code>POST /webhooks/:endpointId/test</Code>,
            <Code>webhooks:write</Code>,
            <>
              Queues a <Code>webhook.test</Code> event.
            </>,
          ],
          [
            <Code>GET /webhooks/deliveries</Code>,
            <Code>webhooks:read</Code>,
            <Code>?status=PENDING|SUCCEEDED|FAILED|EXHAUSTED&amp;endpointId=</Code>,
          ],
          [
            <Code>POST /webhooks/deliveries/:deliveryId/retry</Code>,
            <Code>webhooks:write</Code>,
            "Resets the attempt budget.",
          ],
        ]}
      />

      <UL>
        <li>
          <Strong>The secret is returned twice, ever:</Strong> at create and at rotate. It is
          stored in the clear because signing needs it, but never listed, since a list endpoint is
          the thing that ends up in a log aggregator. Deploy the new secret before the next event
          fires.
        </li>
        <li>
          <Code>http://</Code> URLs are accepted so a tunnel or a local consumer works in
          development. A signed payload over plain HTTP is still readable in transit, so use{" "}
          <Code>https://</Code> in production.
        </li>
        <li>
          The test event is queued through the real pipeline rather than posted inline, which is
          the only way it proves the real path works, signature and all. It is delivered even if
          the endpoint did not subscribe to it, and returns <Code>202</Code> with the delivery row.
        </li>
      </UL>

      <H3>End to end check</H3>

      <Pre>{`# 1. Register.
curl -s -X POST https://api.splito.io/api/v1/webhooks \\
  -H "Authorization: Bearer $SPLITO_KEY" -H 'Content-Type: application/json' \\
  -d '{"url":"https://example.com/splito","events":["*"]}'

# 2. Fire a test through the real pipeline.
curl -s -X POST https://api.splito.io/api/v1/webhooks/$ENDPOINT_ID/test \\
  -H "Authorization: Bearer $SPLITO_KEY"

# 3. Within one dispatch interval, confirm it landed.
curl -s -H "Authorization: Bearer $SPLITO_KEY" \\
  'https://api.splito.io/api/v1/webhooks/deliveries?limit=5'`}</Pre>

      <Pager href={HREF} />
    </article>
  );
}
