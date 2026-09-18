import {
  Callout,
  Code,
  DocLink,
  H2,
  Lead,
  P_,
  PageHeader,
  Pager,
  Pre,
  Strong,
  Table,
  UL,
} from "../../components";

const HREF = "/docs/api/keys";

export const metadata = { title: "API keys" };

export default function ApiKeysPage() {
  return (
    <article>
      <PageHeader href={HREF} />

      <Lead>
        Key management is session authenticated and lives under{" "}
        <Code>/api/organizations/:organizationId/api-keys</Code>, deliberately outside{" "}
        <Code>/api/v1</Code>. A key that can mint keys cannot be contained, so issuing a credential
        always requires a human.
      </Lead>

      <Callout tone="note" title="No key can widen itself">
        <p>
          No API key can create, rotate or rescope a key, including itself. These endpoints take
          the dashboard session cookie and require Owner or Admin. They answer in the first party
          error shape (<Code>{`{ "error": "prose" }`}</Code>), not the{" "}
          <DocLink href="/docs/api/conventions">v1 envelope</DocLink>.
        </p>
      </Callout>

      <H2 id="create">Create</H2>

      <Pre label="POST /api/organizations/:organizationId/api-keys">{`{
  "name": "Ops dashboard sync",
  "scopes": ["dashboard:read", "requests:write", "webhooks:write"],
  "expiresInDays": 365,
  "rateLimitPerMin": 300
}`}</Pre>

      <P_>
        <Code>expiresInDays</Code> and <Code>rateLimitPerMin</Code> are optional: no expiry, and
        the deployment default of 120 requests a minute.
      </P_>

      <Pre label="201, the only response that ever carries a token">{`{
  "id": "clx9k2p00001",
  "name": "Ops dashboard sync",
  "maskedToken": "spl_sk_9vQ2mZbK4tXw_••••••••",
  "prefix": "9vQ2mZbK4tXw",
  "scopes": ["dashboard:read", "requests:write", "webhooks:write"],
  "effectiveScopes": ["dashboard:read", "requests:read", "requests:write", "webhooks:read", "webhooks:write"],
  "state": "active",
  "rateLimitPerMin": 300,
  "createdById": "clu0000admin",
  "createdAt": "2026-09-18T10:00:00.000Z",
  "lastUsedAt": null,
  "requestCount": 0,
  "expiresAt": "2027-09-18T10:00:00.000Z",
  "revokedAt": null,
  "rotatedToId": null,
  "token": "spl_sk_9vQ2mZbK4tXw_8Hc1nR7pLdA3sYfTgVjKmQoZxWbN2eUu",
  "warning": "Copy this token now, it cannot be retrieved after this response."
}`}</Pre>

      <P_>
        <Code>effectiveScopes</Code> is the stored list (which may hold wildcards) resolved to
        concrete scopes, so a management UI never has to reimplement the implication rules.
      </P_>

      <H2 id="list">List</H2>

      <P_>
        <Code>GET /api/organizations/:organizationId/api-keys</Code> returns{" "}
        <Code>{`{ keys, availableScopes, defaultRateLimitPerMin }`}</Code>. Revoked and expired
        keys are included: an audit that hides them is not an audit. The scope catalog travels with
        the list so no client hardcodes a scope string.
      </P_>

      <H2 id="edit">Rename and rescope</H2>

      <P_>
        <Code>PATCH /api/organizations/:organizationId/api-keys/:keyId</Code> takes{" "}
        <Code>{`{ name?, scopes?, rateLimitPerMin? }`}</Code>.
      </P_>

      <Callout tone="warn" title="expiresAt is not editable">
        <p>
          Extending the life of a credential already in the wild is how a key meant for a two week
          integration becomes the one that leaks three years later. Rotate instead.
        </p>
      </Callout>

      <H2 id="rotate">Rotate</H2>

      <P_>
        <Code>POST /api/organizations/:organizationId/api-keys/:keyId/rotate</Code> mints a
        replacement with the same name, scopes and limit, and revokes the old one in the same
        transaction. There is no overlap window, because a rotation with a grace period quietly
        leaves the compromised credential working.
      </P_>

      <P_>
        <Strong>So deploy the new token first, then rotate.</Strong> The <Code>201</Code> carries
        the new <Code>token</Code> plus <Code>revokedKeyId</Code>.
      </P_>

      <H2 id="revoke">Revoke</H2>

      <P_>
        <Code>DELETE /api/organizations/:organizationId/api-keys/:keyId</Code> revokes; it does not
        delete. The row is the record of what that credential was allowed to do and when it last
        did anything, which is exactly what an incident needs. Revoking an already revoked key is a{" "}
        <Code>200</Code>.
      </P_>

      <H2 id="panic">Revoking in a hurry</H2>

      <Table
        head={["Reach", "How"]}
        rows={[
          ["One key", <Code>DELETE /api/organizations/:orgId/api-keys/:keyId</Code>],
          [
            "The whole API surface",
            <>
              <Code>PUBLIC_API_ENABLED=false</Code> on the backend. Every v1 route 503s, key
              management keeps working so keys stay revocable.
            </>,
          ],
          [
            "Every key everywhere",
            <>
              Rotate <Code>API_KEY_PEPPER</Code>. Instant and irreversible: every issued secret
              stops hashing to its stored value.
            </>,
          ],
        ]}
      />

      <UL>
        <li>The last two are server side and need someone with deployment access.</li>
        <li>
          A key also dies on its own when the member it acts as leaves the workspace, checked per
          request rather than cached.
        </li>
      </UL>

      <Pager href={HREF} />
    </article>
  );
}
