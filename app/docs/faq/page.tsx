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
  Strong,
  Table,
  UL,
} from "../components";

const HREF = "/docs/faq";

export const metadata = { title: "Limits and FAQ" };

export default function FaqPage() {
  return (
    <article>
      <PageHeader href={HREF} />

      <Lead>
        The numbers that are fixed, the things that are not built yet, and the handful of problems
        that come up often enough to be worth writing down.
      </Lead>

      <H2 id="limits">Hard limits</H2>

      <Table
        head={["Limit", "Value"]}
        rows={[
          ["Business workspaces per account", "10"],
          ["Invite validity", "7 days from creation"],
          ["Payment link validity", "7, 14 or 30 days, chosen per request"],
          ["Payers on one request", "1 to 50"],
          ["Settlement assets", "XLM and USDC, on Stellar"],
          ["API page size", "100 records"],
          ["API rate limit", "120 requests a minute per key, unless the key says otherwise"],
          ["Idempotency window", "24 hours"],
          ["Webhook attempts", "8, spanning a little over four hours"],
          ["Webhook signature tolerance", "5 minutes, recommended"],
        ]}
      />

      <H2 id="not-yet">Not built yet</H2>

      <P_>
        These are places the product shows you something that is not wired up. They are listed here
        so you do not plan a process around them.
      </P_>

      <UL>
        <li>
          <Strong>Raising an invoice in the dashboard.</Strong> The queue reviews invoices; the API
          creates them. <DocLink href="/docs/invoices">Invoices and approvals</DocLink>.
        </li>
        <li>
          <Strong>Adding a treasury expense in the dashboard.</Strong> The list reads them, the API
          writes them. <DocLink href="/docs/treasury">Treasury Log</DocLink>.
        </li>
        <li>
          <Strong>Signing a contract in the browser.</Strong> The signing page cannot see your
          session, so it keeps showing the sign up prompt. Signatures go through the API for now.{" "}
          <DocLink href="/docs/contracts">Contracts</DocLink>.
        </li>
        <li>
          <Strong>Contract gated access.</Strong> Accepting an invite seats somebody whether or not
          the attached contract is signed. Check the Signed badge before relying on it.
        </li>
        <li>
          <Strong>Approval thresholds and named approvers.</Strong> Visible in Workspace settings,
          not configurable. Every request goes straight out, and every invoice needs an owner or
          admin.
        </li>
        <li>
          <Strong>Per workspace settlement.</Strong> Business workspaces inherit your account
          default, with no override.
        </li>
        <li>
          <Strong>Invoice numbering, session management, automatic nudges.</Strong> Present as
          labels, not yet configurable.
        </li>
        <li>
          <Strong>An API key screen.</Strong> Keys exist and work; the UI for them does not.{" "}
          <DocLink href="/docs/api">Business API</DocLink>.
        </li>
      </UL>

      <H2 id="troubleshooting">Common problems</H2>

      <H3>My invite email never arrived</H3>
      <P_>
        The invite row itself is still valid. Splito tells the inviting admin when delivery fails
        and offers the link to share by hand. Copy the link from the Members screen, or press{" "}
        <Strong>Resend</Strong>, remembering that resending rotates the token and kills the
        previous link.
      </P_>

      <H3>Someone accepted but does not appear</H3>
      <P_>
        Accepting is the only thing that seats a person, and it is immediate. If the row is still
        under <Strong>Pending invites</Strong>, they have opened the link but not accepted it.
        Invites addressed to an email can only be accepted by that address.
      </P_>

      <H3>I cannot create a request</H3>
      <P_>
        Splito validates the Stellar destination before minting a link. An account that has never
        been funded, or one without a USDC trustline when you have chosen USDC, is refused at that
        point. Fund the account, add the trustline, or settle into XLM instead.{" "}
        <DocLink href="/docs/settings">Settings and payouts</DocLink>.
      </P_>

      <H3>The treasury total changed and I did not touch it</H3>
      <P_>
        Totals are converted for display at the current rate, while each entry keeps the currency
        it was recorded in. A move in the market moves the converted total. Nothing in the log has
        changed.
      </P_>

      <H3>A member cannot see the Treasury Log entries</H3>
      <P_>
        Reading treasury entries is owner and admin only. Members see the net figure on the
        dashboard and an empty list. Promote them, or send them the figures.
      </P_>

      <H3>My API call returns 403 insufficient_scope</H3>
      <P_>
        The key does not carry that scope. Write implies read within one resource, never across
        resources, so a key with <Code>invoices:write</Code> still cannot read treasury. Rescope
        the key with <Code>PATCH /api/organizations/:id/api-keys/:keyId</Code>.
      </P_>

      <H3>My webhook signature does not verify</H3>
      <P_>
        The signed string is <Code>&lt;timestamp&gt;.&lt;raw body&gt;</Code>, not the body alone.
        Verify before parsing: if your framework has already parsed and re-serialised the JSON, the
        bytes differ and no amount of correct secret will help.
      </P_>

      <H2 id="contact">Still stuck</H2>
      <P_>
        Email{" "}
        <a
          href="mailto:support@splito.io"
          className="text-[#22D3EE] underline decoration-[#22D3EE]/30 underline-offset-[3px]"
        >
          support@splito.io
        </a>
        . For an API problem, include the <Code>requestId</Code> from the error body: it is on
        every response, including the ones that failed authentication.
      </P_>

      <Callout tone="tip" title="Read this guide end to end once">
        <p>
          It is about twenty minutes, and it is the fastest way to know which parts of Splito to
          build a process on today and which to wait for.
        </p>
      </Callout>

      <Pager href={HREF} />
    </article>
  );
}
