import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SidebarLinks } from "./sidebar-links";

export const metadata: Metadata = {
  title: { default: "Splito for business", template: "%s · Splito docs" },
  description:
    "How to set up and run a Splito business workspace: onboarding, members and roles, contracts, invoices and approvals, payment links, treasury and the Business API.",
  openGraph: {
    type: "article",
    title: "Splito for business",
    description: "The partner guide to running a business workspace in Splito.",
    url: "/docs",
  },
};

/**
 * The documentation shell.
 *
 * Deliberately NOT the app shell. /docs is read by people who have no account
 * yet (it is listed in lib/middleware-session.ts as public, and
 * app/client-layout.tsx renders it chrome-free), so the product sidebar with
 * its session-backed queries has no business mounting here. Nothing on this
 * page fetches: the only client component is the nav, and only so it can mark
 * the current page.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0b0b0b]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[62px] max-w-[1280px] items-center gap-4 px-5 sm:px-8">
          <Link href="/docs" className="flex items-center gap-2.5 no-underline">
            <Image src="/logo.svg" alt="Splito" width={92} height={22} priority />
            <span className="hidden text-[12px] font-bold uppercase tracking-[0.14em] text-[#777] sm:inline">
              Docs
            </span>
          </Link>
          <div className="flex-1" />
          <Link
            href="/"
            className="rounded-full bg-[#22D3EE] px-4 py-2 text-[13px] font-bold text-black no-underline transition-opacity hover:opacity-90"
          >
            Open the app
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 pb-24 sm:px-8 lg:flex-row lg:gap-10">
        {/* Desktop: a sticky column. Mobile: a <details> disclosure, which
            needs no JavaScript and therefore no client component. */}
        <nav className="hidden w-[232px] shrink-0 pt-10 lg:block">
          <div className="sticky top-[86px] max-h-[calc(100vh-110px)] overflow-y-auto pr-2">
            <SidebarLinks />
          </div>
        </nav>

        <details className="mt-5 w-full rounded-[14px] border border-white/[0.08] bg-white/[0.02] lg:hidden">
          <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-bold text-white marker:hidden">
            <span className="text-[#22D3EE]">☰</span> All pages
          </summary>
          <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
            <SidebarLinks />
          </div>
        </details>

        <main className="min-w-0 flex-1 pt-10">{children}</main>
      </div>

      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-1 px-5 py-8 text-[12.5px] text-[#777] sm:px-8">
          <div>
            Splito business guide. Screens shown are a demo workspace, captured from the product
            itself.
          </div>
          <div>
            Something here out of date or missing?{" "}
            <a
              href="mailto:support@splito.io"
              className="text-[#22D3EE] underline decoration-[#22D3EE]/30 underline-offset-[3px]"
            >
              support@splito.io
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
