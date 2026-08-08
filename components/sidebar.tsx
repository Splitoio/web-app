"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  A,
  BORDER,
  Icons,
  MONO,
  PANEL,
  RADIUS,
  SHADOW,
  T,
  avatarChip,
  getUserColor,
  initialsFrom,
  navGroupLabel,
} from "@/lib/splito-design";
import { isNavItemActive, navGroupsFor } from "@/lib/shell-nav";
import { CreateWorkspaceModal } from "@/components/create-workspace-modal";
import { useMobileMenu } from "@/contexts/mobile-menu";
import { useAuthStore } from "@/stores/authStore";
import {
  useActiveWorkspace,
  useSetActiveWorkspace,
  useWorkspaces,
} from "@/contexts/workspace";

const SIDEBAR_WIDTH = 258;

/**
 * The one sidebar. There is no personal/business fork in the chrome itself —
 * only the nav groups differ, and which set renders is decided by the active
 * workspace, never by the URL.
 */
export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, close } = useMobileMenu();
  const { user, isAuthenticated } = useAuthStore();
  const { workspaces, businessCount, businessCap, canCreateBusiness } = useWorkspaces();
  const activeWorkspace = useActiveWorkspace();
  const setActiveWorkspace = useSetActiveWorkspace();

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const navGroups = navGroupsFor(activeWorkspace.kind);
  const wsColor = activeWorkspace.color || A;
  // The cap is the server's verdict (`GET /api/workspaces`), not local
  // arithmetic — the row is disabled with a reason rather than failing on submit.
  const capReason = canCreateBusiness
    ? undefined
    : `You've reached the limit of ${businessCap} workspaces`;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 min-[1025px]:hidden z-50"
          onClick={close}
        />
      )}

      <div
        className={cn(
          "fixed left-0 top-0 z-50 h-screen flex flex-col transition-transform duration-300 ease-in-out min-[1025px]:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          width: SIDEBAR_WIDTH,
          padding: "18px 12px 14px",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          background: "linear-gradient(180deg,#0e0e0e 0%,#0b0b0b 100%)",
        }}
      >
        {/* Logo */}
        <div className="relative flex items-center px-2 mb-4">
          <Link href="/" onClick={close} className="flex items-center">
            <Image src="/logo.svg" alt="Splito" width={120} height={24} className="h-6 w-auto" />
          </Link>
          <button
            onClick={close}
            aria-label="Close menu"
            className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full bg-[#17171A] text-white/70 hover:text-white transition-colors min-[1025px]:hidden"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Workspace switcher */}
        <div ref={switcherRef}>
          <button
            id="sidebar-workspace-switcher"
            type="button"
            onClick={() => setSwitcherOpen((v) => !v)}
            className="tile w-full flex items-center gap-2.5 text-left transition-all"
            style={{
              padding: "10px 11px",
              borderRadius: RADIUS.tile,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              marginBottom: 4,
            }}
          >
            <span style={avatarChip(wsColor, 32, 10)}>{activeWorkspace.initials}</span>
            <span className="flex-1 min-w-0">
              <span className="block truncate" style={{ fontSize: 13, fontWeight: 700, color: T.main }}>
                {activeWorkspace.name}
              </span>
              <span
                className="block"
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: wsColor,
                }}
              >
                {activeWorkspace.kind === "business" ? "Business" : "Personal"}
              </span>
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 9l5-5 5 5M7 15l5 5 5-5" />
            </svg>
          </button>

          {switcherOpen && (
            <div
              className="fade-up"
              style={{
                borderRadius: RADIUS.tile,
                background: PANEL,
                border: "1px solid rgba(255,255,255,0.1)",
                padding: 6,
                marginBottom: 6,
                boxShadow: SHADOW.dropdown,
              }}
            >
              <p style={{ ...navGroupLabel(), letterSpacing: "0.1em", color: T.dim, margin: "6px 10px" }}>
                Workspaces
              </p>
              {workspaces.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    setActiveWorkspace(w.id);
                    setSwitcherOpen(false);
                    close();
                  }}
                  className="nv w-full flex items-center gap-2.5 text-left"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 11,
                    background:
                      w.id === activeWorkspace.id ? "rgba(255,255,255,0.06)" : "transparent",
                  }}
                >
                  <span style={avatarChip(w.color || A, 26, 8)}>{w.initials}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate" style={{ fontSize: 12.5, fontWeight: 600, color: T.main }}>
                      {w.name}
                    </span>
                    <span className="block" style={{ fontSize: 10.5, color: T.dim }}>
                      {w.kind === "business" ? "Business" : "Personal"}
                    </span>
                  </span>
                </button>
              ))}

              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "6px 4px" }} />

              <button
                type="button"
                disabled={!canCreateBusiness}
                title={capReason}
                onClick={() => {
                  setSwitcherOpen(false);
                  close();
                  setCreateOpen(true);
                }}
                className="nv w-full flex items-center gap-2.5 text-left"
                style={{
                  padding: "8px 10px",
                  borderRadius: 11,
                  color: T.sub,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: canCreateBusiness ? "pointer" : "not-allowed",
                  opacity: canCreateBusiness ? 1 : 0.5,
                }}
              >
                <span style={{ width: 26, textAlign: "center", fontSize: 15 }}>+</span>
                New workspace
                <span className="flex-1" />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: T.faded, fontFamily: MONO }}>
                  {businessCount} / {businessCap}
                </span>
              </button>
              {capReason && (
                <p
                  style={{
                    margin: "2px 10px 4px",
                    fontSize: 10.5,
                    lineHeight: 1.4,
                    color: T.faded,
                  }}
                >
                  {capReason}.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Search — ⌘K opens it once the palette lands. */}
        <button
          type="button"
          className="nv flex items-center gap-2.5 w-full text-left transition-all"
          style={{
            padding: "9px 12px",
            borderRadius: RADIUS.control,
            margin: "6px 0 14px",
            color: T.dim,
          }}
        >
          <span>{Icons.search({ size: 15 })}</span>
          <span className="flex-1" style={{ fontSize: 13, fontWeight: 500 }}>
            Search
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: 6,
              background: "rgba(255,255,255,0.06)",
              color: T.faded,
              fontFamily: MONO,
            }}
          >
            ⌘K
          </span>
        </button>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto min-h-0 -mx-0.5 px-0.5">
          {navGroups.map((group) => (
            <div key={group.label} style={{ marginBottom: 18 }}>
              <p style={{ ...navGroupLabel(), margin: "0 0 6px", padding: "0 13px" }}>
                {group.label}
              </p>
              <div className="flex flex-col gap-px">
                {group.items.map((item) => {
                  const active = isNavItemActive(item.href, pathname ?? "");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={close}
                      className="nv flex items-center gap-2.5 transition-all"
                      style={{
                        borderRadius: RADIUS.control,
                        padding: "9px 13px",
                        fontSize: 13.5,
                        background: active ? "rgba(255,255,255,0.07)" : "transparent",
                        color: active ? T.main : "rgba(255,255,255,0.6)",
                        fontWeight: active ? 700 : 500,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 2,
                          flexShrink: 0,
                          background: active ? item.dot : "rgba(255,255,255,0.18)",
                        }}
                      />
                      <span className="flex-1 min-w-0 truncate">{item.label}</span>
                      {item.badge ? (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: "2px 7px",
                            borderRadius: RADIUS.pill,
                            fontFamily: MONO,
                            background: `${item.dot}1a`,
                            color: item.dot,
                          }}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Account panel — guest upsell, or the signed-in user row. */}
        {isAuthenticated && user ? (
          <Link
            href="/settings"
            onClick={close}
            className="nv flex items-center gap-2.5 transition-all"
            style={{ padding: "9px 11px", borderRadius: 14 }}
          >
            <span style={avatarChip(getUserColor(user.name ?? user.email ?? null), 30)}>
              {initialsFrom(user.name, user.email)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate" style={{ fontSize: 12.5, fontWeight: 700, color: T.main }}>
                {user.name || user.email}
              </span>
              <span
                className="block truncate"
                style={{ fontSize: 10.5, fontWeight: 500, color: "rgba(255,255,255,0.4)" }}
              >
                {user.email}
              </span>
            </span>
            {Icons.chevD({ size: 13 })}
          </Link>
        ) : (
          <div
            style={{
              padding: "13px 14px",
              borderRadius: 16,
              background: "rgba(34,211,238,0.06)",
              border: "1px solid rgba(34,211,238,0.2)",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: A }}>Guest session</p>
            <p style={{ margin: "4px 0 10px", fontSize: 11, lineHeight: 1.5, color: T.muted }}>
              Everything here lives in this browser only.
            </p>
            <Link
              href="/signup"
              onClick={close}
              className="btn block text-center"
              style={{
                padding: 8,
                borderRadius: 10,
                background: A,
                color: "#0a0a0a",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Create free account
            </Link>
          </div>
        )}
      </div>

      <CreateWorkspaceModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

export { SIDEBAR_WIDTH };
