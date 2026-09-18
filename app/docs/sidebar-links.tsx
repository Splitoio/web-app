"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_SECTIONS } from "./nav";

/**
 * The only client component in /docs, and only because "which page am I on"
 * cannot be answered in a layout server component. Everything else here is
 * static markup.
 */
export function SidebarLinks() {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {DOC_SECTIONS.map((section) => (
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
