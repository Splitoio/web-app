import {
  Callout,
  Code,
  DocLink,
  H2,
  Lead,
  P_,
  PageHeader,
  Pager,
  Table,
  UL,
} from "../../components";

const HREF = "/docs/api/objects";

export const metadata = { title: "Object reference" };

export default function ObjectsPage() {
  return (
    <article>
      <PageHeader href={HREF} />

      <Lead>
        One definition of what each thing looks like on the wire, shared by the REST endpoints and
        the webhook payloads. A parser written for one works on the other unchanged. Dates are ISO
        8601 strings; money is a number in the stated currency.
      </Lead>

      <Table
        head={["Object", "Key fields"]}
        rows={[
          [
            <Code>organization</Code>,
            <Code>id, name, description, image, color, memberCount, createdAt</Code>,
          ],
          [<Code>member</Code>, <Code>userId, role, name, email, image, joinedAt</Code>],
          [
            <Code>invite</Code>,
            <Code>
              id, email, role, status, kind (email/link), expiresAt, acceptedAt, contractId,
              createdBy
            </Code>,
          ],
          [
            <Code>request</Code>,
            <Code>
              id, name, amount, currency, category, destination&#123;asset,chain,address&#125;,
              status, payerCount, paidCount, receivedAmount, group, workspaceId, expiresAt,
              createdAt, updatedAt
            </Code>,
          ],
          [<Code>request_payer</Code>, <Code>userId, name, email, shareAmount, isPaid</Code>],
          [
            <Code>invoice</Code>,
            <Code>
              id, amount, currency, status, dueDate, description, imageUrl, contractId, issuer,
              recipient, createdAt, updatedAt
            </Code>,
          ],
          [
            <Code>income_stream</Code>,
            <Code>id, name, amount, currency, description, receivedDate</Code>,
          ],
          [
            <Code>treasury_expense</Code>,
            <Code>id, name, amount, currency, description, spentDate</Code>,
          ],
          [
            <Code>contract</Code>,
            <Code>
              id, title, description, status, assignedTo&#123;email,userId&#125;, jobTitle,
              compensation&#123;amount,currency,frequency&#125;, startDate, endDate, signedAt,
              signerName
            </Code>,
          ],
          [
            <Code>activity</Code>,
            <Code>id, type, note, actor&#123;userId,name&#125;, invoiceId, contractId, createdAt</Code>,
          ],
          [
            <Code>webhook_endpoint</Code>,
            <Code>
              id, url, description, events, enabled, consecutiveFailures, disabledAt,
              lastSuccessAt, lastFailureAt (plus secret on create and rotate only)
            </Code>,
          ],
          [
            <Code>webhook_delivery</Code>,
            <Code>
              id, endpointId, eventId, eventType, status, attempts, nextAttemptAt, lastAttemptAt,
              responseStatus, error
            </Code>,
          ],
        ]}
      />

      <H2 id="gotchas">Two fields that surprise people</H2>

      <UL>
        <li>
          <Code>request.name</Code> is <Code>null</Code> when the stored name is the legacy
          &quot;Payment request&quot; default. That is not a name a human typed, so it is not
          reported as one.
        </li>
        <li>
          <Code>request.currency</Code> is the denomination currency, never the token symbol the
          row also stores. The token is under <Code>destination.asset</Code>.
        </li>
      </UL>

      <Callout tone="note" title="The generated half">
        <p>
          Full schemas, including every enum and every nullable, are in{" "}
          <DocLink href="/docs/openapi.business-api.yaml">openapi.business-api.yaml</DocLink>.
          Generate a typed client from it rather than hand-writing these shapes.
        </p>
      </Callout>

      <P_>
        Every object also carries an <Code>object</Code> discriminator, so a heterogeneous list or
        a webhook payload can be dispatched on without inspecting keys. See{" "}
        <DocLink href="/docs/api/conventions">Conventions</DocLink>.
      </P_>

      <Pager href={HREF} />
    </article>
  );
}
