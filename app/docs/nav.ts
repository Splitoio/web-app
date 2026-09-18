/**
 * The documentation's table of contents.
 *
 * One list, three consumers: the sidebar, the previous/next pager at the foot
 * of every page, and each page's `<title>`. Adding a page means adding a row
 * here and a `page.tsx` at the matching href, nothing else.
 */

export type DocPage = {
  href: string;
  /** Sidebar label. Short. */
  label: string;
  /** Page heading and <title>. */
  title: string;
  /** One line under the heading, and the sidebar tooltip. */
  summary: string;
};

export type DocSection = { label: string; pages: DocPage[] };

export const DOC_SECTIONS: DocSection[] = [
  {
    label: "Start here",
    pages: [
      {
        href: "/docs",
        label: "Overview",
        title: "Splito for business",
        summary: "What the business workspace does, and the shortest path through it.",
      },
      {
        href: "/docs/getting-started",
        label: "Onboarding",
        title: "Onboarding",
        summary: "From no account to a working business workspace, in about ten minutes.",
      },
      {
        href: "/docs/workspaces",
        label: "Workspaces",
        title: "Workspaces",
        summary: "Personal money and business money, kept apart and switched in one place.",
      },
    ],
  },
  {
    label: "Your team",
    pages: [
      {
        href: "/docs/team",
        label: "Members and roles",
        title: "Members and roles",
        summary: "Who gets in, what each role may do, and how invites behave.",
      },
      {
        href: "/docs/contracts",
        label: "Contracts",
        title: "Contracts",
        summary: "Agree the rate and the cadence before anybody raises a bill against it.",
      },
    ],
  },
  {
    label: "Money",
    pages: [
      {
        href: "/docs/requests",
        label: "Requests and payment links",
        title: "Requests and payment links",
        summary: "Ask in the currency you price in, settle in the one you hold.",
      },
      {
        href: "/docs/invoices",
        label: "Invoices and approvals",
        title: "Invoices and approvals",
        summary: "The queue that stands between a bill being raised and it being paid.",
      },
      {
        href: "/docs/treasury",
        label: "Treasury Log",
        title: "Treasury Log",
        summary: "Money in and money out, per currency, with a net you can trust.",
      },
    ],
  },
  {
    label: "Account",
    pages: [
      {
        href: "/docs/settings",
        label: "Settings and payouts",
        title: "Settings and payouts",
        summary: "Display currency, wallets, and where settlements actually land.",
      },
      {
        href: "/docs/api",
        label: "Business API",
        title: "Business API",
        summary: "Keys, scopes, idempotency and webhooks for server to server work.",
      },
      {
        href: "/docs/faq",
        label: "Limits and FAQ",
        title: "Limits and FAQ",
        summary: "Hard numbers, known gaps, and what to do when something looks wrong.",
      },
    ],
  },
];

export const DOC_PAGES: DocPage[] = DOC_SECTIONS.flatMap((section) => section.pages);

export const docPage = (href: string): DocPage | undefined =>
  DOC_PAGES.find((page) => page.href === href);

/** Neighbours in reading order, for the pager. `null` at either end. */
export function docNeighbours(href: string): { prev: DocPage | null; next: DocPage | null } {
  const index = DOC_PAGES.findIndex((page) => page.href === href);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? DOC_PAGES[index - 1] : null,
    next: index < DOC_PAGES.length - 1 ? DOC_PAGES[index + 1] : null,
  };
}
