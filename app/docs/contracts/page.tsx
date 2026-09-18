import {
  Callout,
  Code,
  DocLink,
  Figure,
  H2,
  Lead,
  P_,
  PageHeader,
  Pager,
  Strong,
  Table,
  UL,
} from "../components";

const HREF = "/docs/contracts";

export const metadata = { title: "Contracts" };

export default function ContractsPage() {
  return (
    <article>
      <PageHeader href={HREF} />

      <Lead>
        A contract in Splito is the agreement a member works under: the job, the scope, the rate,
        how often it is paid, when it starts and how much notice either side owes. It lives on the
        member&apos;s row, so the terms are one click from the person rather than in a folder
        somewhere.
      </Lead>

      <H2 id="creating">Creating one</H2>

      <P_>
        Two ways in, and they open the same form. <Strong>Add contract</Strong> on an existing
        member&apos;s row, or <Strong>Require a signed contract</Strong> while inviting somebody
        new. Both are owner and admin only.
      </P_>

      <Figure
        shot="16-add-contract"
        caption="The contract form: name, job title, scope of work, rate and frequency, start and end dates, notice period and a free text special clause."
      />

      <Table
        head={["Field", "What it is for"]}
        rows={[
          ["Contract name", "How it appears on the member row and in the activity feed."],
          ["Job title", "The role, as you would write it on an offer."],
          ["Scope of work", "What is included. This is the part that settles arguments later."],
          [
            "Rate and frequency",
            "An amount and a currency, paid Monthly, Weekly or One-time.",
          ],
          ["Starts and ends", "Leave the end date empty for an open ended engagement."],
          ["Notice (days)", "How much notice either side gives. Recorded, not enforced."],
          ["Special clause", "Anything else that has to be on the record."],
        ]}
      />

      <H2 id="signing">Signing</H2>

      <P_>
        Creating a contract mints a signing link of the form <Code>app.splito.io/sign/&lt;token&gt;</Code>{" "}
        and emails it to the address you assigned it to. Opening it shows the contract and offers
        sign up or log in.
      </P_>

      <Figure
        shot="29-sign-contract"
        caption="The signing link as it arrives, before the assignee has an account."
      />

      <Callout tone="gap" title="Signing in the browser is not wired up yet">
        <p>
          The signing screen renders the contract and a signature pad, but the page it lives on is
          treated as public, so a signed-in assignee is still shown the sign up prompt above and
          cannot reach the pad. Until that is fixed, signatures are applied through{" "}
          <Code>PATCH /api/contracts/:id/sign</Code>, and the signed PDF it generates is attached to
          the contract exactly as it would be from the UI.
        </p>
        <p>
          Practically: send the contract, agree it out of band if you need a signature today, and
          use the record in Splito as the shared source of the terms.
        </p>
      </Callout>

      <Callout tone="warn" title="A contract does not gate access on its own">
        <p>
          The invite copy says access comes only after signing, but accepting the invite link seats
          the person whether or not they have signed. Treat &quot;Require a signed contract&quot; as
          &quot;attach these terms to this invite&quot;, and check the Signed badge on the member row
          before you rely on it.
        </p>
      </Callout>

      <H2 id="tracking">Tracking what is agreed</H2>

      <P_>
        Once signed, the member row shows the contract name, the rate and a{" "}
        <Strong>Signed</Strong> badge. <Strong>View contract</Strong> opens the full record, with a
        download button for the generated PDF.
      </P_>

      <Figure
        shot="17-contract-detail"
        caption="A signed contract: the date it was signed, the organisation, the job title, the compensation and cadence, the duration, the notice period, and who created it."
      />

      <UL>
        <li>
          An unsigned contract shows on the pending invite row instead, with the job title next to
          the invited address.
        </li>
        <li>
          Contract created, and contract signed, both write entries into the workspace activity
          feed on the dashboard.
        </li>
        <li>
          Revoking a contract also removes that person from the workspace. It is the undo for a
          hire, not a way to edit terms: to change terms, update the contract.
        </li>
      </UL>

      <P_>
        Roles and invites are covered in <DocLink href="/docs/team">Members and roles</DocLink>.
      </P_>

      <Pager href={HREF} />
    </article>
  );
}
