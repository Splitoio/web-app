"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_TABS, tabFor } from "./nav";

/**
 * The two client components in /docs, and only because "which page am I on"
 * cannot be answered in a layout server component. Everything else is static
 * markup: no fetch, nothing else to hydrate.
 */

/** Guide / API. Lives in the header so it is visible at every width. */
export function DocsTabs() {
  const pathname = usePathname() ?? "/docs";
  const activeTab = tabFor(pathname);

  return (
    <div className="flex gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] p-1">
      {DOC_TABS.map((tab) => {
        const active = tab.id === activeTab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3.5 py-[5px] text-[12.5px] font-bold no-underline transition-colors ${
              active ? "bg-white/[0.1] text-white" : "text-[#8a8a8a] hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

/** The section list for whichever tab is active. */
export function SidebarLinks() {
  const pathname = usePathname() ?? "/docs";
  const activeTab = tabFor(pathname);

  return (
    <div className="space-y-6">
      {activeTab.sections.map((section) => (
        <div key={section.label}>
          <div className="mb-2 px-2 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#666]">
            {section.label}
          </div>
          <div className="space-y-[2px]">
            {section.pages.map((page) => {
              const active = pathname === page.href;
              return (
                <Link
                  key={page.href}
                  href={page.href}
                  title={page.summary}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-[9px] px-2 py-[7px] text-[13.5px] leading-[1.35] no-underline transition-colors ${
                    active
                      ? "bg-white/[0.07] font-semibold text-white"
                      : "text-[#b4b4b4] hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {page.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
