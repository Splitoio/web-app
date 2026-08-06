"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { A, Icons } from "@/lib/splito-design";

const NAV_ITEMS = [
  { key: "home",     label: "Home",     href: "/",        icon: Icons.home     },
  { key: "settings", label: "Settings", href: "/settings",icon: Icons.settings },
];

export function PersonalMobileNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav
      className="fixed -bottom-4 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40 min-[1025px]:hidden"
      style={{
        background: "rgba(10,10,10,0.97)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        padding: "12px 8px 28px",
      }}
    >
      <div className="flex justify-around">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 min-w-0 flex-1 py-0.5 transition-all duration-200 font-[inherit] no-underline",
                active ? "text-[#22D3EE]" : "text-white/40"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-[10px] transition-all duration-200",
                  active && "bg-[#22D3EE]/20"
                )}
              >
                {item.icon({ size: 20 })}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium truncate max-w-full",
                  active && "font-bold"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
