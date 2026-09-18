import {
  Callout,
  Code,
  DocLink,
  Figure,
  H2,
  H3,
  Lead,
  P_,
  PageHeader,
  Pager,
  Status,
  Strong,
  Table,
  UL,
} from "../components";
import { A, G, O, P, R, T } from "@/lib/splito-design";

const HREF = "/docs/invoices";

export const metadata = { title: "Invoices and approvals" };

export default function InvoicesPage() {
  return (
    <article>
      <PageHeader href={HREF} />

      <Lead>
        An invoice is money somebody is asking the workspace for: a contractor&apos;s month, a
        supplier&apos;s bill, a teammate&apos;s expense claim. Nothing is paid because it was
        raised. It waits in <Strong>Needs approval</Strong> until an owner or an admin acts on it.
      </Lead>

      <H2 id="queue">The approval queue</H2>

      <Figure
        shot="12-approvals"
        caption="Needs approval. Each row carries who raised it, the due date, the amount and the note, with the two decisions on the right."
      />

      <UL>
        <li>
          <Strong>Approve</Strong> accepts the bill. It leaves the queue and the activity feed
          records who approved it.
        </li>
        <li>
          <Strong>Decline with a note</Strong> asks for a reason in a browser prompt, then declines
          with it attached. The note is what the issuer is told, so write it for them.
        </li>
        <li>Both are owner and admin only. A member opening this screen is told so plainly.</li>
      </UL>

      <Callout tone="note" title="Approving is not paying">
        <p>
          Approval says &quot;this is owed&quot;. Paying it, and then clearing it, are separate
          moves. That separation is the point: the person who agrees the bill and the person who
          releases the money do not have to be the same, and the trail shows both.
        </p>
      </Callout>

      <H2 id="lifecycle">The statuses</H2>

      <Table
        head={["Status", "Means", "Can become"]}
        rows={[
          [
            <Status tone={T.sub}>DRAFT</Status>,
            "Raised but not submitted.",
            "SENT, APPROVED, DECLINED, PAID, CLEARED, CANCELLED",
          ],
          [
            <Status tone={A}>SENT</Status>,
            "Submitted, waiting on a decision. This is the approval queue.",
            "APPROVED, DECLINED, PAID, CANCELLED",
          ],
          [
            <Status tone={G}>APPROVED</Status>,
            "Agreed as owed, not yet paid.",
            "PAID, CLEARED",
          ],
          [
            <Status tone={R}>DECLINED</Status>,
            "Refused, with a note explaining why.",
            "CLEARED",
          ],
          [<Status tone={P}>PAID</Status>, "Money has gone out against it.", "CLEARED"],
          [
            <Status tone={O}>OVERDUE</Status>,
            "Past its due date and still unpaid. Splito sets this, nobody else can.",
            "PAID",
          ],
          [
            <Status tone={G}>CLEARED</Status>,
            "Settled end to end. The terminal state.",
            "Nothing",
          ],
          [
            <Status tone={T.sub}>CANCELLED</Status>,
            "Withdrawn by the issuer before anybody acted.",
            "Nothing",
          ],
        ]}
      />

      <P_>
        An invoice can never be un-sent, and nothing can be moved back to DRAFT. OVERDUE is set by
        the passing of the due date, never asserted by a caller.
      </P_>

      <H2 id="raising">Raising one</H2>

      <Callout tone="gap" title="No form in the console yet">
        <p>
          The dashboard reviews invoices; it does not yet raise them. Today they arrive through{" "}
          <Code>POST /api/v1/invoices</Code> on the{" "}
          <DocLink href="/docs/api">Business API</DocLink>, which is how a billing system, a
          contractor portal or a script would create them anyway. Everything downstream, the queue,
          the statuses, the emails and the activity feed, behaves identically whatever raised it.
        </p>
      </Callout>

      <H3>What an invoice carries</H3>

      <UL>
        <li>An amount and a currency.</li>
        <li>A due date, which is what makes it overdue later.</li>
        <li>A description, which is the line the approver reads in the queue.</li>
        <li>Optionally an attachment, for the receipt or the supplier&apos;s own PDF.</li>
        <li>An issuer, which is whoever raised it, and optionally a recipient.</li>
      </UL>

      <H2 id="notifications">Who gets told</H2>

      <Table
        head={["When", "Email goes to"]}
        rows={[
          ["An invoice is raised", "Every owner and admin of the workspace"],
          ["It is approved", "The person who raised it"],
          ["It is declined", "The person who raised it, with your note"],
          ["It is cleared", "The person who raised it"],
          ["It is marked paid", "Nobody. The status change is silent."],
        ]}
      />

      <P_>
        Every one of those also writes a row into the workspace activity feed on the dashboard, so
        the audit trail does not depend on anyone&apos;s inbox.
      </P_>

      <Pager href={HREF} />
    </article>
  );
}
