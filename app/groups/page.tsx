"use client";

import { GroupsList } from "@/components/groups-list";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CreateGroupForm } from "@/components/create-group-form";
import { Icons, T, A, BORDER } from "@/lib/splito-design";

export default function GroupsPage() {
  const searchParams = useSearchParams();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleOpenModal = () => setIsCreateModalOpen(true);
    document.addEventListener("open-create-group-modal", handleOpenModal);
    return () => document.removeEventListener("open-create-group-modal", handleOpenModal);
  }, []);

  useEffect(() => {
    if (searchParams.get("openCreate") === "1") {
      setIsCreateModalOpen(true);
      window.history.replaceState(null, "", "/groups");
    }
  }, [searchParams]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Below 1025px the shell's own <Topbar/> isn't mounted (app/client-layout.tsx)
          — this is the only heading + create affordance in that range. At
          >=1025px the shell topbar already renders the title and the single
          "+ Create" button, so this stays hidden there rather than showing a
          second one. */}
      <div
        className="hidden sm:flex min-[1025px]:hidden items-center justify-between sticky top-0 z-10 px-7 h-[70px] border-b border-white/[0.07] bg-[#0b0b0b]/95 backdrop-blur-xl"
      >
        <h1 className="text-[18px] sm:text-[20px] font-extrabold tracking-[-0.02em] text-white">
          My Groups
        </h1>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-1.5 rounded-xl text-[12px] sm:text-[13px] font-extrabold text-[#0a0a0a] transition-all hover:opacity-90 shrink-0 py-2.5 px-3 sm:py-2.5 sm:px-[18px]"
          style={{ background: A, gap: 6 }}
        >
          <Icons.plus /> New Group
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-7">
        {/* Mobile status bar + header, mirroring mobile design spec */}
        <div className="sm:hidden mb-3">
          {/* Status bar */}
         
          {/* Page header */}
          <div className=" pb-2 px-0">
            <p
              className="text-[13px] font-medium"
              style={{ color: T.muted }}
            >
              Your groups
            </p>
            <h1 className="text-[26px] font-black tracking-[-0.04em] text-white mt-1">
              Groups
            </h1>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(255,255,255,0.04)",
            border: BORDER,
            borderRadius: 14,
            padding: "11px 16px",
            marginBottom: 24,
            gap: 8
          }}
        >
          <span style={{ color: T.muted, display: "flex" }}>{Icons.search()}</span>
          <input
            placeholder="Search groups…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              fontSize: 14,
              outline: "none",
              width: "100%",
              fontFamily: "inherit",
              fontWeight: 500
            }}
          />
        </div>
        <GroupsList searchQuery={searchQuery} />
      </div>
      <CreateGroupForm
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
