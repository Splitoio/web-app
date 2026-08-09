"use client";

import { FriendsList } from "@/components/friends-list";
import { useCallback, useState } from "react";
import { Icons, T, A, INSET, RADIUS } from "@/lib/splito-design";
import { usePageActions, usePageTitle } from "@/contexts/page-title";
import { toast } from "sonner";
import { useAddFriend } from "@/features/friends/hooks/use-add-friend";
import { useInviteFriend } from "@/features/friends/hooks/use-invite-friend";
import { isValidEmail } from "@/utils/validation";
import { Loader2, X } from "lucide-react";

function EmailActionModal({
  title,
  sub,
  cta,
  isPending,
  onSubmit,
  onClose,
}: {
  title: string;
  sub: string;
  cta: string;
  isPending: boolean;
  onSubmit: (email: string) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const submit = () => {
    const value = email.trim();
    if (!value) return;
    if (!isValidEmail(value)) {
      toast.error("Please enter a valid email address (e.g. name@example.com)");
      return;
    }
    onSubmit(value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="fixed inset-0"
        style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(16px)" }}
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-[440px] rounded-[28px] p-7"
        style={{
          background: "linear-gradient(160deg, #141414 0%, #0f0f0f 100%)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
        }}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <p style={{ color: "#fff", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {title}
            </p>
            <p style={{ color: T.mid, fontSize: 12, marginTop: 4 }}>{sub}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.60)",
              width: 34,
              height: 34,
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <input
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !isPending && submit()}
          placeholder="friend@email.com"
          disabled={isPending}
          style={{
            width: "100%",
            background: INSET,
            border: "1.5px solid rgba(255,255,255,0.09)",
            borderRadius: 14,
            padding: "12px 16px",
            color: "#fff",
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
            fontFamily: "inherit",
            fontWeight: 500,
            marginBottom: 16,
          }}
        />

        <button
          onClick={submit}
          disabled={isPending || !email.trim() || !isValidEmail(email.trim())}
          style={{
            width: "100%",
            padding: "13px",
            background: email.trim() && isValidEmail(email.trim()) ? A : INSET,
            color: email.trim() && isValidEmail(email.trim()) ? "#0a0a0a" : "#555",
            border: "none",
            borderRadius: 14,
            fontSize: 14,
            fontWeight: 800,
            cursor: isPending ? "default" : "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : cta}
        </button>
      </div>
    </div>
  );
}

/**
 * People's two header actions.
 *
 * Both are OUTLINE buttons, not filled: they sit beside the shell's filled
 * "+ Create" (components/topbar.tsx), and a header row with two accent fills
 * has no primary action at all. Metrics track the neighbouring Create button —
 * RADIUS.control, 13px/700 — so the row reads as one set of controls.
 */
function PeopleActions({
  onAdd,
  onInvite,
}: {
  onAdd: () => void;
  onInvite: () => void;
}) {
  const style = {
    borderRadius: RADIUS.control,
    padding: "9px 15px",
    fontSize: 13,
    fontWeight: 700,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    color: T.body,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap" as const,
  };

  return (
    <>
      <button type="button" onClick={onAdd} className="abtn transition-all" style={style}>
        Add by email
      </button>
      <button type="button" onClick={onInvite} className="abtn transition-all" style={style}>
        Invite a friend
      </button>
    </>
  );
}

export default function PeoplePage() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const { mutate: addFriend, isPending: isAdding } = useAddFriend();
  const { mutate: inviteFriend, isPending: isInviting } = useInviteFriend();

  const openAdd = useCallback(() => setAddOpen(true), []);
  const openInvite = useCallback(() => setInviteOpen(true), []);

  // Drop the shell's static subtitle for this screen. `pageMetaFor()` still
  // carries one for every other route, so this is an override, not an edit to
  // lib/shell-nav.ts — an empty string is <Topbar/>'s "render no subtitle".
  usePageTitle("People", "");

  // The two actions live in the header row, beside the bell and "+ Create".
  usePageActions(
    () => <PeopleActions onAdd={openAdd} onInvite={openInvite} />,
    [openAdd, openInvite]
  );

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Below 1025px the shell's own <Topbar/> isn't mounted (app/client-layout.tsx)
          — this is the only heading in that range, and the only place the
          header actions can go. At >=1025px the shell topbar renders both
          (usePageActions above), so this whole row stays hidden there. */}
      <div className="border-b border-white/[0.07] px-4 sm:px-7 sticky top-0 bg-[#0b0b0b]/95 backdrop-blur-xl z-10 flex min-[1025px]:hidden items-center gap-2.5 min-h-[70px] py-3 flex-wrap">
        <h1 className="text-[18px] sm:text-[20px] font-extrabold tracking-[-0.02em] text-white mr-auto">
          People
        </h1>
        <PeopleActions onAdd={openAdd} onInvite={openInvite} />
      </div>

      <div className="flex-1 p-4 sm:p-7 overflow-y-auto">
        <div
          className="flex items-center gap-2 rounded-[14px] py-2.5 px-4 mb-4 sm:mb-5 border border-white/[0.08] bg-white/[0.04]"
        >
          <span className="text-[#999]">{Icons.search({})}</span>
          <input
            placeholder="Search people…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none text-white text-[14px] outline-none font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-splito-a"
          />
        </div>

        <FriendsList search={search} onAddFriendClick={openAdd} />
      </div>

      {addOpen && (
        <EmailActionModal
          title="Add by email"
          sub="Add someone you already split expenses with."
          cta="Add"
          isPending={isAdding}
          onClose={() => setAddOpen(false)}
          onSubmit={(email) =>
            addFriend(email, {
              onSuccess: (data: { message?: string }) => {
                setAddOpen(false);
                toast.success(data?.message || "Added");
              },
              onError: (error: { message?: string }) => {
                toast.error(error?.message || "Failed to add");
              },
            })
          }
        />
      )}

      {inviteOpen && (
        <EmailActionModal
          title="Invite a friend"
          sub="Send an email invite to someone new to Splito."
          cta="Send invite"
          isPending={isInviting}
          onClose={() => setInviteOpen(false)}
          onSubmit={(email) =>
            inviteFriend(
              { email, sendInviteEmail: true },
              {
                onSuccess: () => {
                  setInviteOpen(false);
                  toast.success("Invite sent");
                },
                onError: (error: { message?: string }) => {
                  toast.error(error?.message || "Failed to send invite");
                },
              }
            )
          }
        />
      )}
    </div>
  );
}
