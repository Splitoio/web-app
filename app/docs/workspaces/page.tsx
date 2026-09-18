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

const HREF = "/docs/workspaces";

export const metadata = { title: "Workspaces" };

export default function WorkspacesPage() {
  return (
    <article>
      <PageHeader href={HREF} />

      <Lead>
        One account, several workspaces. Your personal money is one of them, and each business you
        belong to is another. The workspace you are in decides what every screen shows, so it is
        worth knowing how to read the switcher at a glance.
      </Lead>

      <Figure
        shot="11-workspace-switcher"
        caption="The switcher lists your personal workspace, then each business you belong to, then New workspace with a counter of how many of the ten you have used."
      />

      <H2 id="two-kinds">Personal and business</H2>

      <Table
        head={["", "Personal", "Business"]}
        rows={[
          ["What it holds", "Your own requests, groups and friends", "The company's money and people"],
          ["Who can see it", "Only you", "Every member of that workspace"],
          ["Roles", "None", "Owner, Admin, Member"],
          ["Extra screens", "Groups, People", "Needs approval, Members, Treasury Log"],
          ["How many", "Exactly one, always", "Up to ten per account"],
        ]}
      />

      <P_>
        The routes are the same in both. <Code>/requests</Code> means &quot;the requests you have
        made&quot; in a personal workspace and &quot;everything owed to and by this business&quot;
        in a business one. That is why switching workspace, rather than navigating, is how you
        change context.
      </P_>

      <Callout tone="note" title="The switch is remembered">
        <p>
          Splito stores your active workspace in your browser, so the next visit opens where you
          left off. On a different browser or a phone, switch once more.
        </p>
      </Callout>

      <H2 id="what-members-see">What each role sees in the sidebar</H2>

      <P_>
        A member of a business workspace gets a shorter nav than an owner or admin: approvals are
        not theirs to give, so the item is not there at all rather than being there and refusing
        them.
      </P_>

      <Figure
        shot="32-member-view"
        caption="The same workspace seen by a Member. No Needs approval item. Members, and Treasury Log, are read only for them."
      />

      <UL>
        <li>
          <Strong>Owner and Admin</Strong> see Dashboard, Requests &amp; invoices, Needs approval,
          Members, Treasury Log, Notifications and Settings.
        </li>
        <li>
          <Strong>Member</Strong> sees the same list without Needs approval. They can open Members
          to see who is in the workspace and their own contract, but not invite, promote or remove
          anybody.
        </li>
      </UL>

      <P_>
        The full permission table is on{" "}
        <DocLink href="/docs/team">Members and roles</DocLink>.
      </P_>

      <H2 id="limits">Limits worth knowing</H2>

      <UL>
        <li>An account may create or join up to ten business workspaces.</li>
        <li>
          Deleting a business workspace is the Owner&apos;s call alone, and it takes its invoices,
          contracts, treasury entries and invites with it.
        </li>
        <li>
          Leaving a workspace does not delete anything you raised in it. The record stays with the
          business.
        </li>
      </UL>

      <Pager href={HREF} />
    </article>
  );
}
