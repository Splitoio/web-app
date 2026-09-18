import {
  CardGrid,
  Callout,
  DocLink,
  Figure,
  H2,
  Lead,
  NavCard,
  P_,
  PageHeader,
  Pager,
  Strong,
  Table,
  UL,
} from "./components";

const HREF = "/docs";

export default function OverviewPage() {
  return (
    <article>
      <PageHeader href={HREF} />

      <Lead>
        A Splito business workspace is one place for the money your company is owed and the money it
        pays out: the people who may raise a bill, the agreement each of them works under, the queue
        of what needs approving, and a log of everything that has come in and gone out. Your clients
        never need an account to pay you.
      </Lead>

      <Figure
        shot="10-business-dashboard"
        caption="The business dashboard: treasury balance split by currency, what is waiting on your sign-off, open requests, and the workspace activity feed."
      />

      <H2 id="what-it-does">What it does</H2>

      <Table
        head={["You want to", "In Splito"]}
        rows={[
          [
            "Get paid by a client",
            "Create a request. Send them a link. They pay from any wallet, with no account and no install.",
          ],
          [
            "Price in one currency, hold another",
            "Denominate in any of the supported fiat currencies, settle into USDC or XLM on Stellar.",
          ],
          [
            "Let your team bill you",
            "Seat them in the workspace. What they raise lands in Needs approval, not in your bank.",
          ],
          [
            "Agree terms before work starts",
            "Attach a contract to the invite. Rate, cadence, scope and notice period are on the record.",
          ],
          [
            "Know where you stand",
            "The Treasury Log holds money in and money out per currency, and the dashboard nets it.",
          ],
          [
            "Wire it into your own systems",
            "The Business API covers requests, invoices, members and treasury, with signed webhooks.",
          ],
        ]}
      />

      <H2 id="shape">How the pieces fit</H2>

      <P_>
        Four ideas carry the whole product. Everything else in this guide is a detail of one of
        them.
      </P_>

      <UL>
        <li>
          <Strong>Workspace.</Strong> Your personal money and each business you belong to are
          separate workspaces. The active workspace, not the URL, decides what every screen shows.
        </li>
        <li>
          <Strong>Member.</Strong> Somebody seated in the workspace, with a role that decides what
          they may do. Nobody is seated until they accept an invite.
        </li>
        <li>
          <Strong>Request.</Strong> Money you are asking for, with a link the payer opens. It can be
          split across several payers, and it settles on chain.
        </li>
        <li>
          <Strong>Invoice.</Strong> Money somebody is asking the workspace for. It has to be
          approved before it is paid, and every move is recorded in the activity feed.
        </li>
      </UL>

      <Callout tone="tip" title="Ten minute path">
        <p>
          Sign up, create the workspace, invite one teammate, record one income entry, and send
          yourself a payment link. That covers every screen an owner touches in a normal week.
          Start at <DocLink href="/docs/getting-started">Onboarding</DocLink>.
        </p>
      </Callout>

      <H2 id="where-next">Where to go next</H2>

      <CardGrid>
        <NavCard href="/docs/getting-started" title="Onboarding">
          Create the account and the workspace, and understand the first run tour.
        </NavCard>
        <NavCard href="/docs/team" title="Members and roles">
          Invites by email or link, what Owner, Admin and Member each see.
        </NavCard>
        <NavCard href="/docs/requests" title="Requests and payment links">
          Ask for money in any currency and share a link that needs no account.
        </NavCard>
        <NavCard href="/docs/invoices" title="Invoices and approvals">
          The approval queue, the statuses, and who may move an invoice along.
        </NavCard>
        <NavCard href="/docs/treasury" title="Treasury Log">
          Record income and spend, and read the net across currencies.
        </NavCard>
        <NavCard href="/docs/api" title="Business API">
          Keys, scopes, idempotency and webhook signatures.
        </NavCard>
      </CardGrid>

      <Pager href={HREF} />
    </article>
  );
}
