"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  UserPlus,
  LayoutDashboard,
  ChevronLeft,
  ChevronsUpDown,
  Plus,
  Activity,
  FileSignature,
  FileText,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Icons, getUserColor } from "@/lib/splito-design";
import { useMobileMenu } from "@/contexts/mobile-menu";
import { useAuthStore } from "@/stores/authStore";
import { useGetAllOrganizations } from "@/features/business/hooks/use-organizations";
import { useGetAllGroups } from "@/features/groups/hooks/use-create-group";
import { APP_MODE } from "@/lib/app-mode";
import { motion, AnimatePresence } from "framer-motion";

function isOrgAdmin(
  org: { userId: string; groupUsers?: { userId: string; role?: string | null }[] },
  currentUserId: string
): boolean {
  if (org.userId === currentUserId) return true;
  const membership = org.groupUsers?.find((gu) => gu.userId === currentUserId);
  return membership?.role === "ADMIN";
}

const dropdownVariants = {
  hidden: { opacity: 0, y: 4, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 4, scale: 0.98 },
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const isOrganizationMode =
    APP_MODE === "organization" || pathname.startsWith("/organization");
  const { isOpen, close } = useMobileMenu();
  const { user } = useAuthStore();
  const [orgSwitcherOpen, setOrgSwitcherOpen] = useState(false);
  const orgSwitcherRef = useRef<HTMLDivElement>(null);

  const { data: organizations = [], isError: isOrgsError } = useGetAllOrganizations({
    enabled: isOrganizationMode && !!user,
  });
  const { data: groups = [] } = useGetAllGroups({ type: "PERSONAL" });
  const logo = "/logo.svg";

  const orgPathMatch = pathname.match(/^\/organization\/([^/]+)\/(invoices|finances|streams|expenses|activity|contracts|members|settings)$/);
  const currentOrgId = orgPathMatch?.[1] ?? null;
  const currentOrgTab = orgPathMatch?.[2] ?? "invoices";
  const linkOrgId = currentOrgId ?? organizations[0]?.id ?? null;
  const currentOrg = (currentOrgId ? organizations.find((o) => o.id === currentOrgId) : organizations[0]) ?? null;
  const isAdminOfLinkOrg = !!currentOrg && !!user && isOrgAdmin(currentOrg, user.id);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (orgSwitcherRef.current && !orgSwitcherRef.current.contains(e.target as Node)) {
        setOrgSwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="hidden min-[1025px]:block">
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 brightness-50 min-[1025px]:hidden z-50"
          onClick={close}
        />
      )}

      <div
        className={cn(
          "fixed left-0 top-0 z-50 h-screen transition-all duration-300 ease-in-out shadow-xl min-[1025px]:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "w-[226px] border-r border-white/[0.07]"
        )}
        style={{ background: "linear-gradient(180deg, #0e0e0e 0%, #0b0b0b 100%)" }}
      >
        <div className="flex h-full flex-col px-[14px] py-[22px]">
          {/* Logo/Brand – same in both modes */}
          <div className="flex items-center relative pl-2 gap-2.5 mb-8">
            <Link href={isOrganizationMode ? "https://splito.io" : "/"} onClick={close} className="z-10 flex items-center">
              <Image src={logo} alt="Splito Logo" width={120} height={32} className="h-8 w-auto" />
            </Link>
            <button
              onClick={close}
              className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full bg-[#17171A] text-white/70 hover:text-white transition-colors min-[1025px]:hidden"
              aria-label="Close menu"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Main Navigation */}
          <nav className="flex flex-col gap-0.5">
            {/* Dashboard - shared; in personal mode use design styling */}
            {(!isOrganizationMode ? (
              <Link
                id="sidebar-dashboard-link"
                href="/"
                onClick={close}
                className={cn(
                  "splito-nav-item flex items-center gap-2.5 rounded-[13px] py-2.5 px-[13px] text-sm transition-all",
                  pathname === "/" && !pathname.startsWith("/groups/")
                    ? "bg-white/[0.09] text-white font-bold"
                    : "text-white/60 font-medium hover:bg-white/[0.07] hover:text-[#e8e8e8]"
                )}
              >
                <span className={pathname === "/" ? "text-[#22D3EE]" : "inherit"}>{Icons.plus({ size: 16 })}</span>
                New request
              </Link>
            ) : (
              <Link
                id="sidebar-dashboard-link"
                href="/organization"
                onClick={close}
                className={cn(
                  "splito-nav-item flex items-center gap-2.5 rounded-[13px] py-2.5 px-[13px] text-sm transition-all",
                  pathname === "/organization"
                    ? "bg-white/[0.09] text-white font-bold"
                    : "text-white/60 font-medium hover:bg-white/[0.07] hover:text-[#e8e8e8]"
                )}
              >
                <span className={pathname === "/organization" ? "text-[#22D3EE]" : "inherit"}><LayoutDashboard className="h-4 w-4" strokeWidth={1.5} /></span>
                Dashboard
              </Link>
            ))}

            {/* ── Organization mode: connection error hint when APIs fail ── */}
            {isOrganizationMode && !linkOrgId && isOrgsError && (
              <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-amber-200/90 text-xs font-medium">Couldn&apos;t load organizations</p>
                <Link
                  href="/organization"
                  onClick={close}
                  className="text-amber-300/80 text-xs hover:text-amber-200 mt-0.5 inline-block underline"
                >
                  View details on dashboard →
                </Link>
              </div>
            )}

            {/* ── Organization mode links (when an org is selected) ── */}
            {isOrganizationMode && linkOrgId && (
              <>
                <Link
                  id="sidebar-org-invoices-link"
                  href={`/organization/${linkOrgId}/invoices`}
                  onClick={close}
                  className={cn(
                    "splito-nav-item flex items-center gap-2.5 rounded-[13px] py-2.5 px-[13px] text-sm transition-all",
                    pathname === `/organization/${linkOrgId}/invoices`
                      ? "bg-white/[0.09] text-white font-bold"
                      : "text-white/60 font-medium hover:bg-white/[0.07] hover:text-[#e8e8e8]"
                  )}
                >
                  <span className={pathname === `/organization/${linkOrgId}/invoices` ? "text-[#22D3EE]" : "inherit"}><FileText className="h-4 w-4" strokeWidth={1.5} /></span>
                  Invoices
                </Link>

                {isAdminOfLinkOrg && (() => {
                  const financesActive =
                    pathname === `/organization/${linkOrgId}/finances` ||
                    pathname === `/organization/${linkOrgId}/expenses` ||
                    pathname === `/organization/${linkOrgId}/streams`;
                  return (
                    <Link
                      id="sidebar-org-finances-link"
                      href={`/organization/${linkOrgId}/finances`}
                      onClick={close}
                      className={cn(
                        "splito-nav-item flex items-center gap-2.5 rounded-[13px] py-2.5 px-[13px] text-sm transition-all",
                        financesActive
                          ? "bg-white/[0.09] text-white font-bold"
                          : "text-white/60 font-medium hover:bg-white/[0.07] hover:text-[#e8e8e8]"
                      )}
                    >
                      <span className={financesActive ? "text-[#22D3EE]" : "inherit"}><Receipt className="h-4 w-4" strokeWidth={1.5} /></span>
                      Finances
                    </Link>
                  );
                })()}

                {isAdminOfLinkOrg && (
                  <Link
                    id="sidebar-org-activity-link"
                    href={`/organization/${linkOrgId}/activity`}
                    onClick={close}
                    className={cn(
                      "splito-nav-item flex items-center gap-2.5 rounded-[13px] py-2.5 px-[13px] text-sm transition-all",
                      pathname === `/organization/${linkOrgId}/activity`
                        ? "bg-white/[0.09] text-white font-bold"
                        : "text-white/60 font-medium hover:bg-white/[0.07] hover:text-[#e8e8e8]"
                    )}
                  >
                    <span className={pathname === `/organization/${linkOrgId}/activity` ? "text-[#22D3EE]" : "inherit"}><Activity className="h-4 w-4" strokeWidth={1.5} /></span>
                    Activity
                  </Link>
                )}

                <Link
                  id="sidebar-org-contracts-link"
                  href={`/organization/${linkOrgId}/contracts`}
                  onClick={close}
                  className={cn(
                    "splito-nav-item flex items-center gap-2.5 rounded-[13px] py-2.5 px-[13px] text-sm transition-all",
                    pathname === `/organization/${linkOrgId}/contracts`
                      ? "bg-white/[0.09] text-white font-bold"
                      : "text-white/60 font-medium hover:bg-white/[0.07] hover:text-[#e8e8e8]"
                  )}
                >
                  <span className={pathname === `/organization/${linkOrgId}/contracts` ? "text-[#22D3EE]" : "inherit"}><FileSignature className="h-4 w-4" strokeWidth={1.5} /></span>
                  Contracts
                </Link>

                {isAdminOfLinkOrg && (
                  <Link
                    id="sidebar-org-members-link"
                    href={`/organization/${linkOrgId}/members`}
                    onClick={close}
                    className={cn(
                      "splito-nav-item flex items-center gap-2.5 rounded-[13px] py-2.5 px-[13px] text-sm transition-all",
                      pathname === `/organization/${linkOrgId}/members`
                        ? "bg-white/[0.09] text-white font-bold"
                        : "text-white/60 font-medium hover:bg-white/[0.07] hover:text-[#e8e8e8]"
                    )}
                  >
                    <span className={pathname === `/organization/${linkOrgId}/members` ? "text-[#22D3EE]" : "inherit"}><UserPlus className="h-4 w-4" strokeWidth={1.5} /></span>
                    Members
                  </Link>
                )}

                <Link
                  id="sidebar-org-settings-link"
                  href={`/organization/${linkOrgId}/settings`}
                  onClick={close}
                  className={cn(
                    "splito-nav-item flex items-center gap-2.5 rounded-[13px] py-2.5 px-[13px] text-sm transition-all",
                    pathname === `/organization/${linkOrgId}/settings`
                      ? "bg-white/[0.09] text-white font-bold"
                      : "text-white/60 font-medium hover:bg-white/[0.07] hover:text-[#e8e8e8]"
                  )}
                >
                  <span className={pathname === `/organization/${linkOrgId}/settings` ? "text-[#22D3EE]" : "inherit"}>{Icons.settings({})}</span>
                  Settings
                </Link>
              </>
            )}

            {/* ── Personal mode links (Requests, Settings) ── */}
            {!isOrganizationMode && (
              <>
                <Link
                  id="sidebar-requests-link"
                  href="/requests"
                  onClick={close}
                  className={cn(
                    "splito-nav-item flex items-center gap-2.5 rounded-[13px] py-2.5 px-[13px] text-sm transition-all",
                    pathname === "/requests" || pathname.startsWith("/requests/")
                      ? "bg-white/[0.09] text-white font-bold"
                      : "text-white/60 font-medium hover:bg-white/[0.07] hover:text-[#e8e8e8]"
                  )}
                >
                  <span
                    className={
                      pathname === "/requests" || pathname.startsWith("/requests/")
                        ? "text-[#22D3EE]"
                        : "inherit"
                    }
                  >
                    {Icons.link({ size: 16 })}
                  </span>
                  Requests
                </Link>

                <Link
                  id="sidebar-settings-link"
                  href="/settings"
                  onClick={close}
                  className={cn(
                    "splito-nav-item flex items-center gap-2.5 rounded-[13px] py-2.5 px-[13px] text-sm transition-all",
                    pathname === "/settings"
                      ? "bg-white/[0.09] text-white font-bold"
                      : "text-white/60 font-medium hover:bg-white/[0.07] hover:text-[#e8e8e8]"
                  )}
                >
                  <span className={pathname === "/settings" ? "text-[#22D3EE]" : "inherit"}>{Icons.settings({})}</span>
                  Settings
                </Link>
              </>
            )}
          </nav>

          {/* Personal mode: user card — anonymous visitors have no account,
              so there is nothing real to show here. Never render placeholder
              identity ("You" / "you@email.com"). */}
          {!isOrganizationMode && user && (
            <>
              <div className="mt-auto">
                <div className="flex items-center gap-2.5 py-3 px-[13px] rounded-2xl bg-white/[0.05] border border-white/[0.08]">
                  <div
                    className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0"
                    style={{
                      background: `${getUserColor(user?.name || "You")}1a`,
                      border: `2px solid ${getUserColor(user?.name || "You")}33`,
                      color: getUserColor(user?.name || "You"),
                    }}
                  >
                    {user?.name?.charAt(0)?.toUpperCase() || "Y"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold truncate" style={{ color: "#e8e8e8" }}>{user?.name || "You"}</p>
                    <p className="text-[11px] truncate font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>{user?.email || "you@email.com"}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Bottom Section (organization mode only; pinned to bottom in web view) */}
          {isOrganizationMode && (
              <div className="mt-auto pt-3">
                <div className="relative" ref={orgSwitcherRef}>
                  <button
                    id="sidebar-org-switcher-button"
                    type="button"
                    onClick={() => setOrgSwitcherOpen((v) => !v)}
                    className={cn(
                      "flex w-full items-center gap-2.5 py-3 px-[13px] rounded-2xl text-left transition-colors",
                      "bg-white/[0.05] border border-white/[0.08]",
                      "hover:bg-white/[0.07] hover:border-white/[0.1]",
                      orgSwitcherOpen && "bg-white/[0.07] border-white/[0.1]"
                    )}
                  >
                    <div
                      className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0"
                      style={{
                        background: `${getUserColor(currentOrg?.name || "?")}1a`,
                        border: `2px solid ${getUserColor(currentOrg?.name || "?")}33`,
                        color: getUserColor(currentOrg?.name || "?"),
                      }}
                    >
                      {currentOrg ? currentOrg.name.charAt(0).toUpperCase() : "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold truncate" style={{ color: "#e8e8e8" }}>
                        {currentOrg?.name ?? "Select organization"}
                      </p>
                      <p className="text-[11px] truncate font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>Organization</p>
                    </div>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" style={{ color: "rgba(255,255,255,0.45)" }} strokeWidth={1.5} />
                  </button>

                <AnimatePresence>
                  {orgSwitcherOpen && (
                    <motion.div
                      variants={dropdownVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="absolute left-0 right-0 bottom-full mb-1 rounded-xl bg-[#17171A] border border-white/10 shadow-xl py-2 z-[1001] max-h-[320px] overflow-y-auto"
                    >
                      <div className="px-4 py-2 mb-1">
                        <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Organizations</p>
                      </div>

                      {organizations.length === 0 ? (
                        <div className="px-4 py-3 text-sm">
                          {isOrgsError ? (
                            <span className="text-amber-400/90">Connection error. See dashboard for details.</span>
                          ) : (
                            <span className="text-white/60">No organizations</span>
                          )}
                        </div>
                      ) : (
                        organizations.map((org) => (
                          <Link
                            key={org.id}
                            href={`/organization/${org.id}/${currentOrgTab}`}
                            onClick={() => { close(); setOrgSwitcherOpen(false); }}
                            className={cn(
                              "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                              org.id === currentOrgId
                                ? "bg-white/10 text-white"
                                : "text-white/90 hover:bg-white/5 hover:text-white"
                            )}
                          >
                            <div
                              className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                              style={{
                                background: `${getUserColor(org.name)}1a`,
                                border: `1.5px solid ${getUserColor(org.name)}33`,
                                color: getUserColor(org.name),
                              }}
                            >
                              {org.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate">{org.name}</span>
                          </Link>
                        ))
                      )}

                      <Link
                        id="sidebar-create-org-link"
                        href="/organization/create"
                        onClick={() => { close(); setOrgSwitcherOpen(false); }}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <Plus className="h-4 w-4" strokeWidth={1.5} />
                        Create organization
                      </Link>

                      <div className="border-t border-white/10 mt-2 pt-2">
                        <Link
                          href="/organization/organizations"
                          onClick={() => { close(); setOrgSwitcherOpen(false); }}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors"
                        >
                          Manage all organizations
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
