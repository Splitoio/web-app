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

export default function ApiOverviewPage() {
  return (
    <article>
      <PageHeader href={HREF} />

      <Lead>
        The same data the business dashboard renders, behind a bearer key instead of a session
        cookie. A key belongs to exactly one business workspace and carries scopes, so it cannot
        reach past the business it was minted in.
      </Lead>

      <Table
        rows={[
          ["Base URL", <Code>https://api.splito.io/api/v1</Code>],
          ["Version", <>v1, in the path. A breaking change ships as /api/v2.</>],
          ["Auth", <Code>Authorization: Bearer spl_sk_...</Code>],
          ["Content type", <Code>application/json</Code>],
          [
            "Machine readable",
            <DocLink href="/docs/openapi.business-api.yaml">openapi.business-api.yaml</DocLink>,
          ],
        ]}
      />

      <Callout tone="warn" title="Check availability before you build">
        <p>
          This surface is written and tested, but it is not reachable in production yet:{" "}
          <Code>api.splito.io</Code> does not resolve, and the deployed backend at{" "}
          <Code>server.splito.io</Code> answers 404 on <Code>/api/v1</Code>. Everything below is
          accurate against the code that will ship. Confirm with support before you point an
          integration at it.
        </p>
      </Callout>

      <H2 id="tenancy">One key, one workspace</H2>

      <P_>
        A workspace is either your personal money or one business. The Business API only ever
        addresses a business workspace, and only ever the one its key belongs to.{" "}
        <Strong>There is no organizationId parameter anywhere on the surface</Strong>, not in a
        path, not in a query, not in a body. A <Code>workspaceId</Code> sent to{" "}
        <Code>POST /requests</Code> that disagrees with the key is rejected rather than silently
        overwritten.
      </P_>

      <P_>
        A key&apos;s powers come from its scopes, not from the role of whoever created it. It does
        inherit one thing from its creator though: it stops working the moment that person loses
        their seat, checked on every request. Offboarding somebody offboards their automations.
      </P_>

      <H2 id="quickstart">Quickstart</H2>

      <H3>1. Mint a key</H3>

      <P_>
        Key management is session authenticated and lives outside <Code>/api/v1</Code>. See{" "}
        <DocLink href="/docs/api/keys">API keys</DocLink> for the full lifecycle.
      </P_>

      <Pre label="from a signed-in browser session">{`curl -X POST https://server.splito.io/api/organizations/<organizationId>/api-keys \\
  -H 'Content-Type: application/json' \\
  --cookie "$SPLITO_SESSION_COOKIE" \\
  -d '{ "name": "Ops sync", "scopes": ["dashboard:read", "requests:write"] }'`}</Pre>

      <H3>2. Verify it</H3>

      <Pre label="GET /api/v1/ping">{`curl -s https://api.splito.io/api/v1/ping \\
  -H "Authorization: Bearer $SPLITO_KEY"

{
  "data": {
    "object": "ping",
    "ok": true,
    "apiVersion": "v1",
    "key": { "id": "clx9k2p00001", "name": "Ops sync", "scopes": ["*"], "effectiveScopes": ["..."] },
    "organization": { "id": "clv7org0001", "name": "Harbourline Studio" },
    "serverTime": "2026-09-18T12:00:00.000Z"
  }
}`}</Pre>

      <P_>
        <Code>GET /ping</Code> and <Code>GET /meta</Code> need a valid key but no scope, so a
        narrowly scoped key can still prove itself instead of leaving setup to guesswork.{" "}
        <Code>/meta</Code> returns the scope catalog, the webhook event catalog and the limits this
        deployment enforces, read from the same constants the enforcement reads.
      </P_>

      <H3>3. Do something</H3>

      <Pre label="POST /api/v1/requests">{`curl -X POST https://api.splito.io/api/v1/requests \\
  -H "Authorization: Bearer $SPLITO_KEY" \\
  -H 'Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "amount": 1200,
    "denominationCurrency": "USD",
    "destinationAsset": "usdc-stellar",
    "destinationChain": "stellar",
    "destinationAddress": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    "payerCount": 3,
    "name": "Workshop fee, Kestrel Health"
  }'`}</Pre>

      <H2 id="token">The token</H2>

      <Pre>{`spl_sk_<prefix>_<secret>
        └ 16 chars  └ 43 chars`}</Pre>

      <UL>
        <li>
          The prefix is stored in the clear and is unique, so authenticating is one indexed read.
        </li>
        <li>
          The secret is stored only as <Code>sha256(secret + pepper)</Code> and compared in
          constant time, so a dump of the key table does not let anybody call the API.
        </li>
        <li>
          That is why the plaintext token is returned exactly once, at create or rotate, and can
          never be read back. Lose it and you rotate.
        </li>
        <li>
          A bare token without the <Code>Bearer </Code> prefix is also accepted.
        </li>
      </UL>

      <H3>When a key stops working</H3>

      <Table
        head={["Condition", "Error code"]}
        rows={[
          ["Revoked, or replaced by a rotation", <Code>api_key_revoked</Code>],
          ["Past its expiresAt", <Code>api_key_expired</Code>],
          [
            "The member it acts as is no longer in the workspace",
            <Code>api_key_actor_inactive</Code>,
          ],
        ]}
      />

      <P_>
        A wrong prefix, a wrong secret and a malformed header all answer the same{" "}
        <Code>invalid_api_key</Code>. Telling a caller &quot;that key exists but the secret is
        wrong&quot; would turn a guess into a confirmed hit.
      </P_>

      <Callout tone="note" title="There is no sandbox">
        <p>
          There is no <Code>sk_test_</Code> counterpart, because a test key hitting the same
          database is a live key with a reassuring name. For a scratch environment, create a second
          workspace: that is a real boundary.
        </p>
      </Callout>

      <H2 id="spec">The OpenAPI description</H2>

      <P_>
        <DocLink href="/docs/openapi.business-api.yaml">openapi.business-api.yaml</DocLink> is
        OpenAPI 3.1, generated from the same route table that enforces the permissions. Import it
        into Postman or Insomnia, generate a client, or put it in front of a request validating
        proxy. These pages are the prose half: the rules, the reasons and the runbook.
      </P_>

      <Pager href={HREF} />
    </article>
  );
}
