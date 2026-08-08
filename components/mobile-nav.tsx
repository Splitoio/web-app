"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { A, T, Icons } from "@/lib/splito-design";
import { isNavItemActive, navGroupsFor } from "@/lib/shell-nav";
import { useActiveWorkspace } from "@/contexts/workspace";

// Below 1025px the sidebar is a drawer, so the nav destinations also get a
// bottom bar. Sourced from the same nav table as the sidebar, so personal and
// business workspaces stay in step — see lib/shell-nav.ts.
//
// Serves both workspace kinds: personal is 5 items, business is 6.
const ICON_FOR: Record<string, (p?: { size?: number }) => React.ReactNode> = {
  "/": Icons.home,
  "/requests": Icons.link,
  "/approvals": Icons.check,
  "/groups": Icons.groups,
  "/people": Icons.friends,
  "/members": Icons.userPlus,
  "/treasury": Icons.wallet,
  "/settings": Icons.settings,
};

/**
 * Sidebar labels are written for a 258px rail ("Requests & invoices", "Needs
 * approval") and truncate at a sixth of a 390px viewport. The bar keeps the
 * sidebar's destinations and ordering — the nav table stays the single source
 * of truth — and only shortens the words for this width. The design mock is
 * desktop-only, so there is nothing here to copy from it.
 */
const SHORT_LABEL: Record<string, string> = {
  "/": "Home",
  "/requests": "Requests",
  "/approvals": "Approvals",
  "/groups": "Groups",
  "/people": "People",
  "/members": "Members",
  "/treasury": "Treasury",
  "/settings": "Settings",
};

export function MobileNav() {
  const pathname = usePathname();
  const workspace = useActiveWorkspace();

  const navItems = navGroupsFor(workspace.kind)
    .flatMap((group) => group.items)
    .filter((item) => item.href in ICON_FOR);

  const isActive = (href: string) => isNavItemActive(href, pathname ?? "");

  // Six items have to clear ~58px each on a 360px viewport; five can breathe.
  const tight = navItems.length > 5;

  return (
    <nav
      className="fixed -bottom-4 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40 min-[1025px]:hidden"
      style={{
        background: "rgba(10,10,10,0.97)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        padding: tight ? "10px 4px 28px" : "12px 8px 28px",
      }}
    >
      <div className="flex justify-around">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const label = SHORT_LABEL[item.href] ?? item.label;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center gap-1 min-w-0 flex-1 py-0.5 transition-all duration-200 font-[inherit] no-underline"
              style={{ color: active ? A : T.dim }}
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-[10px] transition-all duration-200",
                  tight ? "w-7 h-7" : "w-8 h-8"
                )}
                style={active ? { background: `${A}33` } : undefined}
              >
                {ICON_FOR[item.href]({ size: tight ? 18 : 20 })}
              </div>
              <span
                className={cn(
                  "font-medium leading-none whitespace-nowrap overflow-hidden text-ellipsis max-w-full",
                  active && "font-bold"
                )}
                style={{ fontSize: tight ? 9.5 : 10, letterSpacing: tight ? "-0.01em" : undefined }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
