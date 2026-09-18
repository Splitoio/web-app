/**
 * The documentation's table of contents.
 *
 * Two tabs, because the audiences are different: the Guide is read by the
 * person running the business, the API reference by whoever is wiring Splito
 * into their own systems. One list drives the tab bar, the sidebar, the
 * previous/next pager and each page's `<title>`. Adding a page means adding a
 * row here and a `page.tsx` at the matching href, nothing else.
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

export type DocTab = {
  id: string;
  label: string;
  /** Where the tab lands, and the prefix that marks it active. */
  href: string;
  sections: DocSection[];
};

const GUIDE_SECTIONS: DocSection[] = [
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
        href: "/docs/faq",
        label: "Limits and FAQ",
        title: "Limits and FAQ",
        summary: "Hard numbers, known gaps, and what to do when something looks wrong.",
      },
    ],
  },
];

const API_SECTIONS: DocSection[] = [
  {
    label: "Getting started",
    pages: [
      {
        href: "/docs/api",
        label: "Overview",
        title: "Business API",
        summary:
          "Programmatic access to one business workspace, behind a bearer key instead of a session.",
      },
      {
        href: "/docs/api/keys",
        label: "API keys",
        title: "API keys",
        summary: "Minting, rotating and revoking the credential, from a human session.",
      },
      {
        href: "/docs/api/scopes",
        label: "Scopes",
        title: "Scopes",
        summary: "What a key may do, how wildcards expand, and why write implies read.",
      },
    ],
  },
  {
    label: "Using it",
    pages: [
      {
        href: "/docs/api/conventions",
        label: "Conventions",
        title: "Conventions",
        summary: "The envelope, the error codes, pagination, idempotency and rate limits.",
      },
      {
        href: "/docs/api/endpoints",
        label: "Endpoints",
        title: "Endpoints",
        summary: "Every route on the surface, with the scope it costs and the rules it enforces.",
      },
      {
        href: "/docs/api/objects",
        label: "Object reference",
        title: "Object reference",
        summary: "The shape of every object the API and the webhooks return.",
      },
    ],
  },
  {
    label: "Events",
    pages: [
      {
        href: "/docs/api/webhooks",
        label: "Webhooks",
        title: "Webhooks",
        summary: "Event detection, the signature, retries, and how to verify a delivery.",
      },
    ],
  },
];

export const DOC_TABS: DocTab[] = [
  { id: "guide", label: "Guide", href: "/docs", sections: GUIDE_SECTIONS },
  { id: "api", label: "API", href: "/docs/api", sections: API_SECTIONS },
];

/**
 * Which tab a path belongs to. Longest prefix wins, so `/docs/api/scopes` is
 * the API tab while `/docs/team` is the Guide, and `/docs` itself falls back
 * to the Guide.
 */
export function tabFor(pathname: string): DocTab {
  const match = [...DOC_TABS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
  return match ?? DOC_TABS[0];
}

export const DOC_PAGES: DocPage[] = DOC_TABS.flatMap((tab) =>
  tab.sections.flatMap((section) => section.pages)
);

export const docPage = (href: string): DocPage | undefined =>
  DOC_PAGES.find((page) => page.href === href);

/** Neighbours in reading order WITHIN a tab. `null` at either end. */
export function docNeighbours(href: string): { prev: DocPage | null; next: DocPage | null } {
  const pages = tabFor(href).sections.flatMap((section) => section.pages);
  const index = pages.findIndex((page) => page.href === href);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? pages[index - 1] : null,
    next: index < pages.length - 1 ? pages[index + 1] : null,
  };
}
