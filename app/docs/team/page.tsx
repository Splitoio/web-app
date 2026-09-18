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
  Steps,
  Strong,
  Table,
  UL,
} from "../components";

const HREF = "/docs/team";

export const metadata = { title: "Members and roles" };

export default function TeamPage() {
  return (
    <article>
      <PageHeader href={HREF} />

      <Lead>
        Members is the one screen that answers &quot;who is in this business, and on what
        terms&quot;. It holds the people who have accepted, the invites still outstanding, and the
        contract each person works under.
      </Lead>

      <Figure
        shot="14-members"
        caption="Members: the seated team above, everything still pending below. A role dropdown and a contract sit on each row."
      />

      <H2 id="roles">The three roles</H2>

      <Table
        head={["", "Owner", "Admin", "Member"]}
        rows={[
          ["See the dashboard, requests and activity", "Yes", "Yes", "Yes"],
          ["Create requests and payment links", "Yes", "Yes", "Yes"],
          ["Approve, decline, mark paid, clear invoices", "Yes", "Yes", "No"],
          ["Invite people, revoke invites", "Yes", "Yes", "No"],
          ["Change someone's role", "Yes", "Yes, except granting Owner", "No"],
          ["Create and revoke contracts", "Yes", "Yes", "No"],
          ["Read and write the Treasury Log", "Yes", "Yes", "No"],
          ["Delete the workspace", "Yes", "No", "No"],
        ]}
      />

      <UL>
        <li>Only an Owner may make somebody else an Owner.</li>
        <li>
          The last Owner cannot be demoted. Promote a second Owner first if you are handing the
          business over.
        </li>
        <li>
          An admin may remove a member, and anybody may remove themselves. Removing somebody does
          not delete what they raised.
        </li>
      </UL>

      <Callout tone="note" title="A Member is not locked out, just narrower">
        <p>
          Members still see the workspace dashboard, the requests list and the activity feed, and
          they can create requests. What they cannot do is approve money or change who is in the
          room. The Needs approval item is absent from their sidebar rather than present and
          refusing them.
        </p>
      </Callout>

      <H2 id="inviting">Inviting somebody</H2>

      <P_>
        Press <Strong>Invite someone</Strong> on the Members screen. You are choosing three things:
        the address, the role, and whether a contract has to be signed.
      </P_>

      <Figure
        shot="15-invite-someone"
        caption="The invite panel. Role is Admin or Member, never Owner. Copy invite link instead mints a link anybody may use."
      />

      <Steps
        items={[
          {
            title: "Enter the email address, or skip it",
            body: (
              <p>
                With an address, Splito emails the invite and the row is tied to that person. With{" "}
                <Strong>Copy invite link instead</Strong>, you get a link anyone holding it may
                accept, which suits a group chat or a shared onboarding doc.
              </p>
            ),
          },
          {
            title: "Pick the role",
            body: <p>Admin or Member. Ownership is transferred separately, never invited.</p>,
          },
          {
            title: "Decide whether a contract is required",
            body: (
              <p>
                Turning on <Strong>Require a signed contract</Strong> opens the contract form in
                the same panel. See <DocLink href="/docs/contracts">Contracts</DocLink>.
              </p>
            ),
          },
          {
            title: "Send it",
            body: (
              <p>
                Nothing changes on the Members list yet. The invite sits under{" "}
                <Strong>Pending invites</Strong> until it is accepted.
              </p>
            ),
          },
        ]}
      />

      <H3>What the invited person sees</H3>

      <P_>
        The link opens a landing page that names the workspace, who invited them and what role they
        are being given, before any account exists. Signing up from there carries them back to the
        invite.
      </P_>

      <Figure
        shot="28-invite-landing"
        caption="The invite landing page, seen by somebody with no Splito account."
      />

      <P_>
        If they already have an account under the invited address, the invite also waits for them
        in <Strong>Notifications</Strong>, with Accept and Reject on the row.
      </P_>

      <Figure
        shot="33-notifications-invite"
        caption="The same invite, seen inside the app by the person it was addressed to."
      />

      <H2 id="pending">Managing pending invites</H2>

      <Table
        head={["Row", "What it means", "Actions"]}
        rows={[
          [
            "An email address",
            "Addressed to one person. Only that address may accept it.",
            <>
              <Code>Resend</Code> emails it again, <Code>×</Code> revokes it
            </>,
          ],
          [
            "Anyone with the link",
            "A shareable link. The first person to open and accept it takes the seat.",
            <>
              <Code>New link</Code> rotates the token, <Code>×</Code> revokes it
            </>,
          ],
        ]}
      />

      <Callout tone="warn" title="Resending invalidates the old link">
        <p>
          Resending, or minting a new link, rotates the token. Any link you copied earlier stops
          working immediately, which is also how you claw back a link that went to the wrong chat.
        </p>
      </Callout>

      <UL>
        <li>Invites expire seven days after they are created.</li>
        <li>
          An invite creates no account and no membership. Accepting is the only thing that seats
          somebody, and it applies the invited role exactly once.
        </li>
        <li>
          Revoking is instant and silent: nobody is told, the link simply stops resolving.
        </li>
      </UL>

      <H2 id="changing">Changing a role, removing somebody</H2>

      <P_>
        Each member row carries a role dropdown; the change is saved as soon as you pick it, and
        the backend enforces it on the next request that person makes. The{" "}
        <Code>×</Code> at the end of the row removes the
        person from the workspace. Neither action touches invoices, requests or treasury entries
        they created: those belong to the business.
      </P_>

      <Pager href={HREF} />
    </article>
  );
}
