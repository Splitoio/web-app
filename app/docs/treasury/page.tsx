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
  Steps,
  Strong,
  Table,
  UL,
} from "../components";

const HREF = "/docs/treasury";

export const metadata = { title: "Treasury Log" };

export default function TreasuryPage() {
  return (
    <article>
      <PageHeader href={HREF} />

      <Lead>
        The Treasury Log is the workspace&apos;s book of record: money that actually arrived, and
        money that actually went out. It is not a forecast and it is not a copy of your bank feed.
        You put an entry in when the money moved.
      </Lead>

      <Figure
        shot="18-treasury"
        caption="Income above, expenses below, net at the top. Each entry keeps the currency it happened in."
      />

      <H2 id="income">Recording income</H2>

      <P_>
        Press <Strong>Log income</Strong>. Four fields, one of them optional.
      </P_>

      <Figure
        shot="19-log-income"
        caption="Log income received: where it came from, how much and in which currency, an optional note, and the date it landed."
      />

      <Steps
        items={[
          {
            title: "Source",
            body: <p>Who paid: a client name, a platform payout, a grant.</p>,
          },
          {
            title: "Amount and currency",
            body: (
              <p>
                Record it in the currency you were actually paid in. Do not convert by hand: the
                conversion is Splito&apos;s job, and converting first loses the original figure.
              </p>
            ),
          },
          { title: "Note", body: <p>Optional. Useful for a period, an invoice number, a project.</p> },
          {
            title: "Received on",
            body: <p>The date the money landed, which is what the log is ordered by.</p>,
          },
        ]}
      />

      <H2 id="expenses">Recording what went out</H2>

      <P_>
        Expenses appear in the lower half of the same screen: payroll, rent, software, contractors,
        travel. They are workspace level outgoings, not the shared bills of a personal split group,
        and they are recorded rather than paid from here.
      </P_>

      <Callout tone="gap" title="No expense form in the console yet">
        <p>
          The Treasury Log reads expenses and totals them; the dashboard has no button to add one.
          Record them through <Code>POST /api/v1/treasury/expenses</Code> on the{" "}
          <DocLink href="/docs/api">Business API</DocLink>, which takes the same fields as the
          income form with a <Code>spentDate</Code> instead of a received date.
        </p>
      </Callout>

      <H2 id="currency">How multi currency is handled</H2>

      <P_>
        Entries are never summed across currencies. Splito aggregates per currency first, converts
        each bucket at the current rate, and only then shows a single net. That is why the
        dashboard shows a currency split bar under the treasury balance: the composition is part of
        the number.
      </P_>

      <Table
        head={["Figure", "Where", "What it is"]}
        rows={[
          [
            "Treasury balance",
            "Dashboard",
            "Everything recorded as income, converted to your display currency.",
          ],
          [
            "Currency split",
            "Dashboard",
            "The share of that balance sitting in each currency you were paid in.",
          ],
          ["Net", "Treasury Log", "Income minus expenses, again converted for display."],
        ]}
      />

      <Callout tone="note" title="Rates move, so the total moves">
        <p>
          A converted total is a view, not a stored number. An entry always keeps the amount and
          the currency you recorded, and yesterday&apos;s net can differ from today&apos;s without
          anything in the log having changed.
        </p>
      </Callout>

      <H2 id="who">Who can use it</H2>

      <UL>
        <li>
          Reading and writing the Treasury Log is owner and admin only. A member sees the net
          figure on the dashboard but not the entries behind it.
        </li>
        <li>
          Treasury entries are independent of requests and invoices. Being paid through a Splito
          payment link does not add an income entry for you, and clearing an invoice does not add
          an expense.
        </li>
      </UL>

      <Callout tone="tip" title="Backfill once, then keep up">
        <p>
          Enter the current quarter when you set the workspace up. After that, a few minutes a week
          keeps the net honest, and the API can do it for you if your accounting system is the real
          source.
        </p>
      </Callout>

      <Pager href={HREF} />
    </article>
  );
}
