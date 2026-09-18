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

const HREF = "/docs/settings";

export const metadata = { title: "Settings and payouts" };

export default function SettingsPage() {
  return (
    <article>
      <PageHeader href={HREF} />

      <Lead>
        Settings has two halves. <Strong>Account</Strong> follows you into every workspace you
        belong to. <Strong>Workspace</Strong> applies to the business you are currently in. Payouts
        live in the account half, which is why setting them once is enough.
      </Lead>

      <Figure
        shot="23-settings-profile"
        caption="Profile: your display name, your email address and your preferred currency."
      />

      <H2 id="account">Account settings</H2>

      <Table
        head={["Section", "What it controls"]}
        rows={[
          [
            "Profile",
            "Display name, photo, and the currency you think in. Applies everywhere you are a member.",
          ],
          [
            "Display & currency",
            "Whether amounts read in the original currency, yours, or both. Also the default for locking a request's rate.",
          ],
          ["Wallets", "The addresses you own, one default per chain. This is where settled money lands."],
          [
            "Settlement",
            "Which assets you accept and which wallet a new request defaults to.",
          ],
          ["Reminders", "Nudges other people have sent you about money you owe."],
          ["Security", "Change your password, and the product analytics switch."],
        ]}
      />

      <H2 id="wallets">Wallets and settlement</H2>

      <P_>
        These two are the ones that matter before you ask anybody for money. A wallet is an address
        you control. A settlement preference says which assets you accept and which address a new
        request should default to.
      </P_>

      <Figure
        shot="24-settings-wallets"
        caption="Wallets: connect an address, mark one default per chain."
      />

      <Figure
        shot="25-settings-settlement"
        caption="Settlement: the assets you accept and the wallet they land in. Business workspaces inherit this account default."
      />

      <UL>
        <li>Settlement today is Stellar: XLM and USDC.</li>
        <li>
          The setting is account level. Every business workspace you are in inherits it, and there
          is no per workspace override yet.
        </li>
        <li>
          Changing it does not touch requests that are already out. A link keeps the destination it
          was minted with.
        </li>
      </UL>

      <Callout tone="warn" title="Check the address before the money does">
        <p>
          Creating a request validates the destination on chain, so an unfunded account or a
          missing USDC trustline is caught at creation. It is still worth sending yourself a small
          test payment the first time.
        </p>
      </Callout>

      <H2 id="display">Display and currency</H2>

      <Figure
        shot="34-settings-display"
        caption="Show amounts in the original currency, in yours, or both. Both reads as 60.00 dollars followed by the asset amount."
      />

      <P_>
        <Strong>Lock the rate by default</Strong> decides what a new request starts with. Locked,
        you receive the fiat amount you asked for and the market move is the payer&apos;s. Unlocked,
        the payer is quoted at pay time. Either way you can change it per request.
      </P_>

      <H2 id="workspace">Workspace settings</H2>

      <P_>
        The workspace half holds the business name, a shortcut into{" "}
        <DocLink href="/docs/team">Members</DocLink>, and two controls that are visible but not yet
        configurable: invoice numbering, and an approval threshold with a named approver. Until
        those ship, approval is &quot;an owner or admin signs off&quot; and nothing routes
        automatically.
      </P_>

      <Callout tone="note" title="Deleting a workspace">
        <p>
          <Code>Delete workspace</Code> sits at the bottom of Workspace, General, and is owner only.
          It takes the members, invites, contracts, invoices and treasury entries with it. There is
          no undo.
        </p>
      </Callout>

      <Pager href={HREF} />
    </article>
  );
}
