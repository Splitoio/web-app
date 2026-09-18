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

const HREF = "/docs/api/endpoints";

export const metadata = { title: "Endpoints" };

export default function EndpointsPage() {
  return (
    <article>
      <PageHeader href={HREF} />

      <Lead>
        Every route on the surface, the scope it costs, and the rules it will not let a caller
        skip. Paths are relative to <Code>https://api.splito.io/api/v1</Code>.
      </Lead>

      <H2 id="discovery">Discovery</H2>

      <P_>
        Both need a valid key and no scope. A narrowly scoped key must still be able to verify
        itself, or setting one up is guesswork.
      </P_>

      <Table
        head={["Endpoint", "Returns"]}
        rows={[
          [<Code>GET /ping</Code>, "Key identity, its scopes, its workspace, server time."],
          [
            <Code>GET /meta</Code>,
            "Scope catalog, webhook event catalog, and the limits this deployment enforces.",
          ],
        ]}
      />

      <H2 id="dashboard">Dashboard</H2>

      <Table
        head={["Endpoint", "Scope"]}
        rows={[[<Code>GET /dashboard/summary</Code>, <Code>dashboard:read</Code>]]}
      />

      <P_>
        Everything the dashboard hero needs in one call. <Code>?currency=EUR</Code> overrides the
        display currency; omitted, it uses the key owner&apos;s own display currency, so the API
        and the dashboard show the same figure by default.
      </P_>

      <Pre>{`{
  "data": {
    "object": "dashboard_summary",
    "organization": { "id": "clv7org0001", "object": "organization", "name": "Harbourline Studio", "memberCount": 7 },
    "totals": { "outstanding": 4820.5, "received": 12900, "currency": "USD", "requestCount": 41 },
    "countsByStatus": { "OPEN": 9, "PARTIALLY_PAID": 3, "SETTLED": 26, "EXPIRED": 2, "CANCELLED": 1 },
    "approvalQueueCount": 4,
    "treasury": { "streamsTotal": 58000, "streamCount": 12, "expensesTotal": 21400, "expenseCount": 31, "currency": "USD" },
    "recentActivity": [ { "id": "...", "kind": "request", "type": "REQUEST_CREATED", "title": "October retainer", "amount": 1200, "currency": "USD", "status": "OPEN", "createdAt": "..." } ]
  }
}`}</Pre>

      <UL>
        <li>
          <Strong>outstanding excludes cancelled and expired money.</Strong> Nobody is going to pay
          it, so counting it as owed would inflate a figure people plan around.
        </li>
        <li>
          <Strong>A currency whose exchange rate cannot be fetched is dropped from the total</Strong>
          , not added at one to one. A wrong total is worse than a small one.
        </li>
        <li>Rates are fetched once per distinct source currency, not once per row.</li>
      </UL>

      <H2 id="workspace">Workspace and activity</H2>

      <Table
        head={["Endpoint", "Scope", "Notes"]}
        rows={[
          [<Code>GET /organization</Code>, <Code>organization:read</Code>, "Profile and member count."],
          [
            <Code>GET /activity</Code>,
            <Code>activity:read</Code>,
            "Invoice and contract events, newest first.",
          ],
        ]}
      />

      <H2 id="members">Members and invites</H2>

      <Table
        head={["Endpoint", "Scope", "Notes"]}
        rows={[
          [<Code>GET /members</Code>, <Code>members:read</Code>, "Role, name, email, join date."],
          [
            <Code>PATCH /members/:userId</Code>,
            <Code>members:write</Code>,
            <>
              <Code>{`{ "role": "ADMIN" | "MEMBER" }`}</Code>
            </>,
          ],
          [<Code>DELETE /members/:userId</Code>, <Code>members:write</Code>, "Removes the seat."],
          [
            <Code>GET /invites</Code>,
            <Code>members:read</Code>,
            <Code>?status=PENDING|ACCEPTED|REVOKED|DECLINED</Code>,
          ],
          [
            <Code>POST /invites</Code>,
            <Code>members:write</Code>,
            <Code>{`{ email?, role?, sendEmail? }`}</Code>,
          ],
          [
            <Code>POST /invites/:inviteId/revoke</Code>,
            <Code>members:write</Code>,
            "Idempotent.",
          ],
        ]}
      />

      <H3>Rules the API will not let you skip</H3>

      <UL>
        <li>
          <Strong>Owner cannot be granted through the API at all.</Strong> Not by{" "}
          <Code>PATCH /members</Code>, not by an invite. <Code>403 insufficient_scope</Code>.
        </li>
        <li>
          <Strong>A workspace can never be left without an owner.</Strong> <Code>409 conflict</Code>.
        </li>
        <li>
          <Strong>A key cannot remove its own acting member.</Strong> That would disable the key
          mid-call, so it is a <Code>409</Code> instead.
        </li>
        <li>
          <Strong>Creating an invite creates no user and no membership.</Strong> Acceptance is the
          only thing that seats anybody.
        </li>
      </UL>

      <P_>
        <Code>POST /invites</Code> with no <Code>email</Code> mints a link invite anybody holding
        the token may accept. <Code>201</Code> is the only response that carries{" "}
        <Code>inviteUrl</Code>: it is absent from <Code>GET /invites</Code> and from every webhook
        payload, because a pending invite&apos;s token is a seat in the workspace.
      </P_>

      <Pre label={`POST /invites  { "email": "dev@example.com", "role": "MEMBER" }`}>{`{
  "data": {
    "id": "clw3inv0001", "email": "dev@example.com", "role": "MEMBER", "status": "PENDING",
    "kind": "email", "expiresAt": "2026-09-25T12:00:00.000Z", "createdAt": "2026-09-18T12:00:00.000Z",
    "acceptedAt": null, "contractId": null,
    "createdBy": { "id": "clu0000admin", "name": "Ava", "email": "ava@example.com" },
    "inviteUrl": "https://app.splito.io/invite/8Hc1nR7pLdA3sYfTgVjKmQoZ",
    "emailDelivered": true
  }
}`}</Pre>

      <P_>
        Email delivery is awaited, not fire and forget: the invite row is valid either way, but the
        caller needs to know whether it still has to deliver the link itself.{" "}
        <Code>emailDelivered: false</Code> comes with a <Code>deliveryError</Code> saying whether
        sending failed or mail is not configured. Pass <Code>sendEmail: false</Code> to suppress
        the email and send your own.
      </P_>

      <H2 id="requests">Money requests</H2>

      <Table
        head={["Endpoint", "Scope", "Notes"]}
        rows={[
          [
            <Code>GET /requests</Code>,
            <Code>requests:read</Code>,
            <Code>?status=OPEN|PARTIALLY_PAID|SETTLED|EXPIRED|CANCELLED</Code>,
          ],
          [
            <Code>POST /requests</Code>,
            <Code>requests:write</Code>,
            "Creates the request and its payment links.",
          ],
          [
            <Code>GET /requests/:requestId</Code>,
            <Code>requests:read</Code>,
            "Adds the payer roster, notes and live links.",
          ],
          [
            <Code>POST /requests/:requestId/cancel</Code>,
            <Code>requests:write</Code>,
            "Stops further payment.",
          ],
        ]}
      />

      <H3>Creating one</H3>

      <Table
        head={["Field", "Required", "Notes"]}
        rows={[
          [<Code>amount</Code>, "yes", "Positive number."],
          [
            <Code>denominationCurrency</Code>,
            "yes",
            <>
              Fiat code the amount is denominated in, e.g. <Code>USD</Code>.
            </>,
          ],
          [
            <Code>destinationAsset</Code>,
            "yes",
            <>
              <Code>usdc-stellar</Code> or <Code>xlm</Code>.
            </>,
          ],
          [
            <Code>destinationChain</Code>,
            "yes",
            <>
              <Code>stellar</Code>.
            </>,
          ],
          [<Code>destinationAddress</Code>, "yes", "Validated for that chain before a link is minted."],
          [<Code>payerCount</Code>, "one of", "Anonymous payer slots, maximum 50."],
          [
            <Code>groupId</Code>,
            "one of",
            "Addresses the request to a group; every member except the requester gets a named share and their own link.",
          ],
          [<Code>name</Code>, "", "Human label."],
          [<Code>expiresAt</Code>, "", "ISO 8601, must be in the future. Defaults to 7 days."],
          [<Code>category</Code>, "", ""],
          [
            <Code>timeLockIn</Code>,
            "",
            "Lock the fiat to asset rate at creation. Defaults to the acting member's preference.",
          ],
          [<Code>note</Code>, "", "Single free text note."],
          [<Code>fileKey</Code>, "", "Attachment reference."],
        ]}
      />

      <Callout tone="note" title="New requests settle on Stellar only">
        <p>
          Creation accepts <Code>usdc-stellar</Code> and <Code>xlm</Code> on{" "}
          <Code>stellar</Code>, and rejects anything else with a <Code>400</Code> listing the
          pairs it will take. Solana destinations on older rows stay readable and payable; they
          just cannot be minted any more.
        </p>
      </Callout>

      <UL>
        <li>
          <Code>payerCount</Code> and <Code>groupId</Code> are mutually exclusive. They answer the
          same question and accepting both has no defensible resolution.
        </li>
        <li>
          <Code>workspaceId</Code> must be omitted. Supplying one that differs from the key is a{" "}
          <Code>400</Code> rather than a silent overwrite, because a caller that named a workspace
          has a belief about where the money is going.
        </li>
      </UL>

      <Pre label="201">{`{
  "data": {
    "object": "request", "id": "clw9req0001", "status": "OPEN",
    "workspaceId": "clv7org0001", "group": null, "category": "general",
    "payerCount": 3, "expiresAt": "2026-09-25T12:00:00.000Z",
    "timeLockIn": false, "exchangeRate": null, "fileKey": null, "note": null,
    "paymentLinks": [
      { "userId": "clu0shadow1", "name": null, "shareAmount": 40, "url": "https://app.splito.io/pay/8Hc1nR7p...?payer=clu0shadow1" }
    ]
  }
}`}</Pre>

      <H3>Reading and cancelling</H3>

      <UL>
        <li>
          <Code>GET /requests/:id</Code> adds <Code>payers[]</Code>, <Code>notes[]</Code> and{" "}
          <Code>paymentLinks[]</Code>. The links array is empty once the link has expired: a URL
          that no longer works should not be published as if it did.
        </li>
        <li>
          An anonymous payer slot reports <Code>name: null</Code> and <Code>email: null</Code>{" "}
          rather than a fabricated placeholder.
        </li>
        <li>
          <Strong>Status is effective, not stored.</Strong> A request past its{" "}
          <Code>expiresAt</Code> reads <Code>EXPIRED</Code> even though no job has flipped the
          column, and <Code>?status=OPEN</Code> excludes lapsed requests.
        </li>
        <li>
          <Code>receivedAmount</Code> is the sum of shares actually paid, in the denomination
          currency. It is not a live valuation of what landed on chain: that is not stored, so it
          is not reported.
        </li>
        <li>
          Cancelling refuses terminal statuses rather than overwriting them, and re-cancelling is
          reported as already done. <Strong>Shares already paid are untouched:</Strong> this
          cancels the ask, not the payments.
        </li>
      </UL>

      <H2 id="invoices">Invoices</H2>

      <Table
        head={["Endpoint", "Scope", "Notes"]}
        rows={[
          [<Code>GET /invoices</Code>, <Code>invoices:read</Code>, <Code>?status=</Code>],
          [
            <Code>POST /invoices</Code>,
            <Code>invoices:write</Code>,
            "Raises one. The issuer is the key's acting member.",
          ],
          [<Code>GET /invoices/:invoiceId</Code>, <Code>invoices:read</Code>, ""],
          [
            <Code>PATCH /invoices/:invoiceId</Code>,
            <Code>invoices:write</Code>,
            <Code>{`{ status, note? }`}</Code>,
          ],
        ]}
      />

      <P_>
        <Code>POST /invoices</Code> takes{" "}
        <Code>{`{ amount, currency, dueDate, description?, status?, imageUrl?, fileKey? }`}</Code>.{" "}
        <Code>status</Code> may be <Code>DRAFT</Code> (default, invisible to approvers) or{" "}
        <Code>SENT</Code> (enters the approval queue). <Code>contractId</Code> is deliberately not
        accepted: the first party path only links a contract that is assigned to the issuer and
        already sent, which is a statement about a person who read and signed something.
      </P_>

      <P_>
        Raising an invoice writes an activity row and emails every owner and admin, exactly as the
        dashboard does.
      </P_>

      <H3>Legal status moves</H3>

      <Table
        head={["Target", "Allowed from"]}
        rows={[
          [<Code>SENT</Code>, "DRAFT"],
          [<Code>APPROVED</Code>, "DRAFT, SENT"],
          [<Code>DECLINED</Code>, "DRAFT, SENT"],
          [<Code>PAID</Code>, "APPROVED, DRAFT, SENT, OVERDUE"],
          [<Code>CLEARED</Code>, "APPROVED, DECLINED, PAID, DRAFT"],
          [<Code>CANCELLED</Code>, "DRAFT, SENT"],
        ]}
      />

      <UL>
        <li>
          <Code>OVERDUE</Code> and <Code>DRAFT</Code> are not transition targets. An invoice cannot
          be un-sent, and overdue means the due date passed.
        </li>
        <li>
          Anything else is <Code>409 conflict</Code> with the allowed set in the message.
        </li>
        <li>
          Asking for the status an invoice already has returns it unchanged, so a retry is never an
          error.
        </li>
        <li>
          <Code>APPROVED</Code>, <Code>DECLINED</Code> and <Code>CLEARED</Code> email the issuer.{" "}
          <Code>note</Code> is recorded on the activity row and shown to the issuer on a decline.
        </li>
      </UL>

      <Callout tone="note" title="One known asymmetry">
        <p>
          Moving an invoice to <Code>PAID</Code> writes an <Code>INVOICE_CLEARED</Code> activity
          row, because that is what the dashboard&apos;s own mark-paid does and the feed is
          rendered from these rows. The activity type enum has no <Code>INVOICE_PAID</Code> member
          to log instead. It is recorded here rather than papered over.
        </p>
      </Callout>

      <H2 id="treasury">Treasury</H2>

      <P_>
        Money in is an income stream, money out is a treasury expense. The two are exact mirrors,
        same fields, same verbs, same errors, because the Treasury Log renders them side by side.
      </P_>

      <Table
        head={["Endpoint", "Scope"]}
        rows={[
          [<Code>GET /treasury/income-streams</Code>, <Code>treasury:read</Code>],
          [<Code>POST /treasury/income-streams</Code>, <Code>treasury:write</Code>],
          [<Code>PATCH /treasury/income-streams/:streamId</Code>, <Code>treasury:write</Code>],
          [<Code>DELETE /treasury/income-streams/:streamId</Code>, <Code>treasury:write</Code>],
          [<Code>GET /treasury/expenses</Code>, <Code>treasury:read</Code>],
          [<Code>POST /treasury/expenses</Code>, <Code>treasury:write</Code>],
          [<Code>PATCH /treasury/expenses/:expenseId</Code>, <Code>treasury:write</Code>],
          [<Code>DELETE /treasury/expenses/:expenseId</Code>, <Code>treasury:write</Code>],
        ]}
      />

      <P_>
        Body for both: <Code>{`{ name, amount, currency?, description?, date? }`}</Code>.{" "}
        <Code>date</Code> is the received or spent date (defaults to now) and comes back as{" "}
        <Code>receivedDate</Code> or <Code>spentDate</Code>. <Code>currency</Code> defaults to{" "}
        <Code>USD</Code>. These are not the group scoped expense from bill splitting, which carries
        participants and shares.
      </P_>

      <H2 id="contracts">Contracts</H2>

      <Table
        head={["Endpoint", "Scope"]}
        rows={[
          [<Code>GET /contracts</Code>, <Code>contracts:read</Code>],
          [<Code>GET /contracts/:contractId</Code>, <Code>contracts:read</Code>],
        ]}
      />

      <P_>
        Read only, with no write counterpart. A contract&apos;s whole value is the audit trail
        around how it was signed: the signature, the IP, the user agent, the document hash. Minting
        one from an API key would produce a document with nobody behind it. A contract can be
        assigned to somebody with no account yet, so the identity is{" "}
        <Code>assignedTo.email</Code> and <Code>assignedTo.userId</Code> is nullable.
      </P_>

      <H2 id="webhooks">Webhooks</H2>

      <P_>
        Nine endpoints, covered with the delivery model and signature verification on{" "}
        <DocLink href="/docs/api/webhooks">Webhooks</DocLink>.
      </P_>

      <Pager href={HREF} />
    </article>
  );
}
