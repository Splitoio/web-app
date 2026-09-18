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

const HREF = "/docs/api/scopes";

export const metadata = { title: "Scopes" };

export default function ScopesPage() {
  return (
    <article>
      <PageHeader href={HREF} />

      <Lead>
        Two authorisation questions are answered in two different places. &quot;May this
        workspace&apos;s data be touched at all?&quot; is answered by the key itself, which belongs
        to one workspace and nothing can widen. &quot;May this key do this?&quot; is answered by
        scope.
      </Lead>

      <H2 id="catalog">The catalog</H2>

      <Table
        head={["Scope", "Grants"]}
        rows={[
          [<Code>organization:read</Code>, "Read the workspace profile, its settings and its member count."],
          [
            <Code>dashboard:read</Code>,
            "Read the aggregated dashboard summary: totals, status buckets, treasury, activity.",
          ],
          [<Code>members:read</Code>, "List members and pending invites."],
          [<Code>members:write</Code>, "Invite people, revoke invites and change member roles."],
          [
            <Code>requests:read</Code>,
            "List and read money requests, their payers and their payment links.",
          ],
          [<Code>requests:write</Code>, "Create and cancel money requests."],
          [<Code>invoices:read</Code>, "List and read invoices."],
          [<Code>invoices:write</Code>, "Create invoices and move them through their lifecycle."],
          [<Code>treasury:read</Code>, "Read income streams and treasury expenses."],
          [
            <Code>treasury:write</Code>,
            "Record, edit and delete income streams and treasury expenses.",
          ],
          [<Code>contracts:read</Code>, "List and read contracts."],
          [<Code>activity:read</Code>, "Read the workspace activity feed."],
          [<Code>webhooks:read</Code>, "List webhook endpoints and inspect delivery attempts."],
          [<Code>webhooks:write</Code>, "Create, edit, disable and delete webhook endpoints."],
        ]}
      />

      <P_>
        <Code>GET /api/v1/meta</Code> returns this table from the same constant the enforcement
        reads, so a client can render it without going stale.
      </P_>

      <H2 id="wildcards">Wildcards and implications</H2>

      <UL>
        <li>
          <Code>*</Code> grants everything, including scopes added after the key was minted.
        </li>
        <li>
          <Code>&lt;resource&gt;:*</Code> grants every action on that resource.
        </li>
        <li>
          <Strong>Write implies read, per resource.</Strong> <Code>invoices:write</Code> satisfies{" "}
          <Code>invoices:read</Code> and says nothing about <Code>treasury:read</Code>. Read never
          implies write.
        </li>
      </UL>

      <Pre label="what a key sees">{`granted: ["invoices:write", "treasury:read"]

invoices:read   -> allowed  (write implies read, same resource)
invoices:write  -> allowed
treasury:read   -> allowed
treasury:write  -> 403 insufficient_scope
members:read    -> 403 insufficient_scope`}</Pre>

      <Callout tone="note" title="Why write implies read">
        <p>
          A key that may create invoices but 403s on listing them is a footgun every integration
          works around by asking for both anyway, and the workaround is what actually gets mis-set.
        </p>
      </Callout>

      <H2 id="rules">Two rules that bite at create time</H2>

      <UL>
        <li>
          <Strong>Unknown scopes are rejected, not dropped.</Strong> A key minted with a typo would
          otherwise fail on its first call, far from the cause. The error lists the known scopes.
        </li>
        <li>
          <Strong>A key minted with <Code>*</Code> stores <Code>["*"]</Code> alone.</Strong> Listing
          a narrower scope beside it would imply that revoking the narrow one did something.
        </li>
      </UL>

      <H2 id="withheld">Capabilities the API never grants</H2>

      <P_>
        Three actions are withheld from every scope, because each depends on a human having done
        something:
      </P_>

      <UL>
        <li>
          <Strong>Granting Owner.</Strong> Not through <Code>PATCH /members</Code>, not through an
          invite. Ownership changes hands in the dashboard, in person.
        </li>
        <li>
          <Strong>Creating or signing a contract.</Strong> Contracts are read only over the API. A
          contract&apos;s value is the audit trail around the signature; minting one from a key
          produces a document with nobody behind it.
        </li>
        <li>
          <Strong>Asserting <Code>OVERDUE</Code> on an invoice.</Strong> It means &quot;the due date
          passed&quot;, not &quot;somebody said so&quot;.
        </li>
      </UL>

      <P_>
        Scope errors carry what was needed and what the key holds. See{" "}
        <DocLink href="/docs/api/conventions">Conventions</DocLink> for the error shape.
      </P_>

      <Pager href={HREF} />
    </article>
  );
}
