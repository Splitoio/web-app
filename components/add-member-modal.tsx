"use client";

import {
  useAddMembersToGroup,
} from "@/features/groups/hooks/use-create-group";
import { useAddFriend } from "@/features/friends/hooks/use-add-friend";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "@/lib/constants";
import { isValidEmail } from "@/utils/validation";
import { GroupInviteLink } from "@/components/group-invite-link";
import { A, T } from "@/lib/splito-design";

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  label?: string;
}

export function AddMemberModal({
  isOpen,
  onClose,
  groupId,
  label = "Member",
}: AddMemberModalProps) {
  const [email, setEmail] = useState("");
  const { mutate: addMembersToGroup, isPending } = useAddMembersToGroup();
  const { mutate: addFriend, isPending: isAddingFriend } = useAddFriend();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const handleAddMember = () => {
    const memberEmail = email.trim();
    if (!memberEmail) {
      toast.error("Please enter an email address");
      return;
    }
    if (!isValidEmail(memberEmail)) {
      toast.error("Please enter a valid email address (e.g. name@example.com)");
      return;
    }

    // First add the member to the group
    addMembersToGroup(
      {
        groupId: groupId,
        memberIdentifier: memberEmail,
      },
      {
        onSuccess: () => {
          // Then add as friend
          addFriend(memberEmail, {
            onSuccess: () => {
              toast.success("Admin added and invited as friend");
              setEmail("");

              // refetch the specific group data
              queryClient.invalidateQueries({
                queryKey: [QueryKeys.GROUPS, groupId],
              });

              // refetch the general groups list
              queryClient.invalidateQueries({ queryKey: [QueryKeys.GROUPS] });

              // refetch friends list
              queryClient.invalidateQueries({ queryKey: [QueryKeys.FRIENDS] });

              // Close the modal after successful addition
              onClose();
            },
            onError: (friendError) => {
              // Member was added to group but friend addition failed
              console.error("Failed to add as friend:", friendError);
              toast.success("Admin added to organization");
              toast.warning("Could not add as friend - they may already be your friend");
              setEmail("");

              // refetch queries
              queryClient.invalidateQueries({
                queryKey: [QueryKeys.GROUPS, groupId],
              });
              queryClient.invalidateQueries({ queryKey: [QueryKeys.GROUPS] });

              onClose();
            },
          });
        },
        onError: (error) => {
          toast.error(error.message || "Failed to add admin");
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !(isPending || isAddingFriend) && email.trim() && isValidEmail(email.trim())) {
      handleAddMember();
    }
  };

  if (!isOpen) return null;

  const isDisabled = isPending || isAddingFriend;
  const canSubmit = !isDisabled && !!email.trim() && isValidEmail(email.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(16px)" }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-[460px] rounded-[28px] p-7"
        style={{
          background: "linear-gradient(160deg, #141414 0%, #0f0f0f 100%)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
          animation: "mIn 0.3s cubic-bezier(.34,1.56,.64,1)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p style={{ color: "#fff", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Add {label}
            </p>
            <p style={{ color: T.mid, fontSize: 12, marginTop: 4 }}>
              Share a link, or invite by email.
            </p>
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
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div className="mb-5">
          <GroupInviteLink groupId={groupId} />
        </div>
        <div className="flex items-center gap-2 mb-5">
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: T.dim }}>or</span>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
        </div>

        {/* Email field */}
        <div className="mb-5">
          <label
            style={{
              color: "rgba(204,204,204,0.9)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 8,
              display: "block",
            }}
          >
            {label} Email
          </label>
          <input
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="friend@email.com"
            disabled={isDisabled}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.05)",
              border: "1.5px solid rgba(255,255,255,0.09)",
              borderRadius: 14,
              padding: "12px 16px",
              color: "#fff",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "inherit",
              fontWeight: 500,
            }}
          />
        </div>

        {/* Submit button */}
        <button
          onClick={handleAddMember}
          disabled={!canSubmit}
          style={{
            width: "100%",
            padding: "13px",
            background: canSubmit ? A : "rgba(255,255,255,0.05)",
            color: canSubmit ? "#0a0a0a" : "#555",
            border: "none",
            borderRadius: 14,
            fontSize: 14,
            fontWeight: 800,
            cursor: canSubmit ? "pointer" : "default",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.2s",
          }}
        >
          {isDisabled ? (
            <>
              <Loader2 style={{ width: 16, height: 16, animation: "spin 0.8s linear infinite" }} />
              Adding…
            </>
          ) : (
            `Add ${label}`
          )}
        </button>
      </div>
    </div>
  );
}
