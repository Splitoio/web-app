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
  Steps,
  Strong,
  Table,
  UL,
} from "../components";
import { A, G, O } from "@/lib/splito-design";

const HREF = "/docs/requests";

export const metadata = { title: "Requests and payment links" };

export default function RequestsPage() {
  return (
    <article>
      <PageHeader href={HREF} />

      <Lead>
        A request is money you are asking for. Splito turns it into a link. The payer opens it,
        sees the amount in the currency you quoted, and pays from their own wallet. They do not
        need a Splito account, and they do not need to install anything.
      </Lead>

      <H2 id="create">Creating a request</H2>

      <P_>
        Press <Strong>+ Create</Strong> in the top bar, from any screen in the workspace.
      </P_>

      <Figure
        shot="22-create-request"
        caption="The create screen, with a live preview of what the payer will see on the right."
      />

      <Steps
        items={[
          {
            title: "Choose the kind",
            body: (
              <p>
                <Strong>Request money</Strong> is one link for one or more anonymous payers.{" "}
                <Strong>Request from a group</Strong> asks the named members of a group you already
                have, and needs an account on both sides.
              </p>
            ),
          },
          {
            title: "Set the amount and the currency",
            body: (
              <p>
                You denominate in fiat. The payer sees a live crypto quote at pay time, so nobody
                has to do the conversion in their head.
              </p>
            ),
          },
          {
            title: "Decide whether to lock the rate",
            body: (
              <p>
                <Strong>Lock the rate</Strong> freezes the conversion when you send the link. You
                receive the fiat amount you asked for whatever the token does in between. Leave it
                off and the payer is quoted at the moment they pay.
              </p>
            ),
          },
          {
            title: "Say what it is for, and how many people",
            body: (
              <p>
                The label is what the payer reads on the link. Splitting across several payers
                divides the amount evenly and mints a separate link per share.
              </p>
            ),
          },
          {
            title: "Pick what you settle into",
            body: (
              <p>
                USDC or XLM, on Stellar, into the address shown. That address is prefilled from
                your saved wallet and is fixed for the request: a different address means a new
                request.
              </p>
            ),
          },
          {
            title: "Choose how long the link lives",
            body: <p>Seven, fourteen or thirty days. Fourteen is the default.</p>,
          },
        ]}
      />

      <Callout tone="warn" title="The destination has to exist on chain">
        <p>
          Splito checks the Stellar address before it mints a link, so an unfunded account or a
          missing USDC trustline fails here rather than at payment time, when it would be the
          payer&apos;s problem. Set your wallet up first:{" "}
          <DocLink href="/docs/settings">Settings and payouts</DocLink>.
        </p>
      </Callout>

      <H2 id="tracking">Tracking one</H2>

      <P_>
        Open a request from <Strong>Requests &amp; invoices</Strong> to get the working view: one
        link per payer, who has paid, the settlement details, and a nudge button for the people who
        have not.
      </P_>

      <Figure
        shot="21-request-detail"
        caption="A live request. Copy link per payer, mark somebody paid by hand, nudge the stragglers, or cancel the whole thing."
      />

      <UL>
        <li>
          <Strong>Copy link</Strong> gives that payer their own URL. Sending the same link to two
          people means two people paying the same share.
        </li>
        <li>
          <Strong>Mark paid</Strong> is for money that arrived some other way. It records the share
          as settled without a chain payment.
        </li>
        <li>
          <Strong>Nudge</Strong> sends a reminder to a payer you have in Splito already.
        </li>
        <li>
          <Strong>Cancel request</Strong> kills every remaining link. Shares already paid stay
          paid.
        </li>
      </UL>

      <H3>The list</H3>

      <Figure
        shot="20-requests"
        caption="Requests & invoices, filtered by status, with Export CSV for everything the filter is showing."
      />

      <Table
        head={["Status", "Means"]}
        rows={[
          [<Status tone={A}>Sent</Status>, "The link is live and nobody has paid yet."],
          [<Status tone={O}>Partly paid</Status>, "At least one share has landed, not all of them."],
          [<Status tone={G}>Cleared</Status>, "Every share is settled."],
        ]}
      />

      <H2 id="payer">What the payer sees</H2>

      <P_>
        The link is a single page with no account wall. If the request is split, the payer picks
        which share is theirs, then connects a wallet and pays.
      </P_>

      <Figure
        shot="30-pay-link"
        caption="The payment page: who is asking, how much, what for, and how many people have paid so far."
      />

      <Figure
        shot="31-pay-link-share"
        caption="After picking a share, the payer chooses what to pay with and is quoted against the amount you asked for."
      />

      <Callout tone="tip" title="The link is the product">
        <p>
          Payment links work in a chat, an email, a PDF invoice footer, or a QR code. Nothing about
          them assumes the payer has ever heard of Splito.
        </p>
      </Callout>

      <P_>
        Money that has landed still has to be recorded as income if you want it in the Treasury
        Log. See <DocLink href="/docs/treasury">Treasury Log</DocLink>. To raise money{" "}
        <em>against</em> the workspace instead, see{" "}
        <DocLink href="/docs/invoices">Invoices and approvals</DocLink>. To do any of this from your
        own systems, see the <DocLink href="/docs/api">Business API</DocLink>, where{" "}
        <Code>POST /api/v1/requests</Code> is the same operation.
      </P_>

      <Pager href={HREF} />
    </article>
  );
}
