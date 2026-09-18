import {
  Callout,
  Code,
  DocLink,
  Figure,
  FigureRow,
  H2,
  Lead,
  P_,
  PageHeader,
  Pager,
  Steps,
  Strong,
  UL,
} from "../components";

const HREF = "/docs/getting-started";

export const metadata = { title: "Onboarding" };

export default function GettingStartedPage() {
  return (
    <article>
      <PageHeader href={HREF} />

      <Lead>
        Everything below is the real sequence, in order. You need an email address and about ten
        minutes. You do not need a wallet yet, and you do not need to invite anybody to try it.
      </Lead>

      <H2 id="account">1. Create your account</H2>

      <P_>
        Go to <Code>app.splito.io/signup</Code>. Sign up with Google, or with an email address and a
        password. There is no email verification step and no waiting list: the account exists the
        moment you submit the form.
      </P_>

      <FigureRow>
        <Figure
          shot="01-signup"
          caption="Sign up with a name, an email address and a password, or hand it to Google."
        />
        <Figure
          shot="02-login"
          caption="After sign up you land on the login screen with your address already filled in. Sign in once and you are through."
        />
      </FigureRow>

      <Callout tone="note">
        <p>
          Use a mailbox you will keep. Invites, invoice notifications and contract copies are all
          addressed to it, and the address is how a colleague invites you into their workspace.
        </p>
      </Callout>

      <P_>
        The first screen you see is your <Strong>personal</Strong> workspace: your own requests and
        groups, nothing to do with the company yet. That is expected, and it is where every account
        starts.
      </P_>

      <Figure
        shot="03-personal-dashboard-empty"
        caption="A brand new account. The sidebar is the personal nav: Dashboard, Requests, Groups, People."
      />

      <H2 id="workspace">2. Create the business workspace</H2>

      <P_>
        The workspace switcher at the top of the sidebar is the only way into a business workspace.
        Open it and choose <Strong>New workspace</Strong>.
      </P_>

      <Steps
        items={[
          {
            title: "Open the switcher",
            body: (
              <p>
                It shows every workspace you belong to and a counter for how many business
                workspaces you have used out of the ten an account may hold.
              </p>
            ),
          },
          {
            title: "Name the business",
            body: (
              <p>
                The name is what your team and your invitees see, so use the trading name. The
                description is optional and internal.
              </p>
            ),
          },
          {
            title: "Create it",
            body: (
              <p>
                You become its <Strong>Owner</Strong> immediately, and Splito switches you into the
                new workspace.
              </p>
            ),
          },
        ]}
      />

      <FigureRow>
        <Figure
          shot="04-workspace-switcher-empty"
          caption="The switcher on a fresh account: a personal workspace and nothing else."
        />
        <Figure
          shot="05-create-workspace"
          caption="Naming the workspace. Only the name is required."
        />
      </FigureRow>

      <H2 id="tour">3. The first run tour</H2>

      <P_>
        The first time you land in a business workspace, a six step tour points at the parts of the
        sidebar you will actually use. It runs once per account, whether you finish it or skip it.
      </P_>

      <FigureRow>
        <Figure shot="06-tour-step-1" caption="Step one, on the new workspace's dashboard." />
        <Figure shot="07-tour-step-2" caption="Each later step spotlights a nav item." />
      </FigureRow>

      <P_>
        Behind the tour, an empty business dashboard shows a short <Strong>Get set up</Strong>{" "}
        checklist: invite a teammate, create your first request. Both are covered below.
      </P_>

      <Figure
        shot="09-business-dashboard-empty"
        caption="A business workspace with nothing in it yet. Revenue, outstanding and overdue all read zero until something happens."
      />

      <H2 id="first-week">4. What to do in the first week</H2>

      <UL>
        <li>
          <Strong>Set where money lands.</Strong> Settings holds your display currency, your wallets
          and your settlement preference. A request cannot be created without a destination address,
          so do this before you need it. See{" "}
          <DocLink href="/docs/settings">Settings and payouts</DocLink>.
        </li>
        <li>
          <Strong>Seat your team.</Strong> Invite by email, or copy a link. Give admin only to
          people who should be able to approve money.{" "}
          <DocLink href="/docs/team">Members and roles</DocLink>.
        </li>
        <li>
          <Strong>Put the agreements on the record.</Strong> Attach a contract to a hire's invite so
          the rate and the cadence are agreed before the first bill.{" "}
          <DocLink href="/docs/contracts">Contracts</DocLink>.
        </li>
        <li>
          <Strong>Send one real request.</Strong> A live payment link to a client is the fastest way
          to see the whole loop. <DocLink href="/docs/requests">Requests and payment links</DocLink>
          .
        </li>
        <li>
          <Strong>Backfill the treasury.</Strong> Logging this quarter's income and spend makes the
          dashboard net mean something on day one.{" "}
          <DocLink href="/docs/treasury">Treasury Log</DocLink>.
        </li>
      </UL>

      <Callout tone="tip" title="Phones work too">
        <p>
          The console is responsive: the same workspace, the same permissions, a bottom nav instead
          of a sidebar. Approving an invoice from a phone is the common case.
        </p>
      </Callout>

      <FigureRow>
        <Figure
          shot="26-mobile-dashboard"
          width="phone"
          caption="The dashboard at phone width."
        />
        <Figure
          shot="27-mobile-approvals"
          width="phone"
          caption="The approval queue, same actions."
        />
      </FigureRow>

      <Pager href={HREF} />
    </article>
  );
}
