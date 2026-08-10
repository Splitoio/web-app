"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { useGroupLayout } from "@/contexts/group-layout-context";
import {
  useUpdateGroup,
  useDeleteGroup,
  useAddMembersToGroup,
} from "@/features/groups/hooks/use-create-group";
import { useAddFriend } from "@/features/friends/hooks/use-add-friend";
import { useUploadFile } from "@/features/files/hooks/use-balances";
import { GroupInviteLink } from "@/components/group-invite-link";
import { isValidEmail } from "@/utils/validation";
import {
  card,
  eyebrow,
  avatarChip,
  getUserColor,
  Toggle,
  Icons,
  T,
  A,
  R,
  INSET,
} from "@/lib/splito-design";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 13,
  border: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.03)",
  padding: "12px 15px",
  fontSize: 14,
  color: T.main,
  outline: "none",
  fontFamily: "inherit",
};

/**
 * Group Settings — design's gSettings panel (1340-1391): name, photo &
 * colour, add someone, "lock the rate", delete group. Colour is display-only
 * (the backend never gained a PATCH for it — it's set once at creation, same
 * as before this pass); invite-link generation was removed from the frontend
 * in an earlier PR and isn't resurrected here.
 */
export default function GroupSettingsPage() {
  const router = useRouter();
  const { groupId, group, isAdmin } = useGroupLayout();
  const updateGroupMutation = useUpdateGroup();
  const deleteGroupMutation = useDeleteGroup();
  const addMembersMutation = useAddMembersToGroup();
  const addFriendMutation = useAddFriend();
  const uploadFileMutation = useUploadFile();

  const [name, setName] = useState(group?.name ?? "");
  const [addEmail, setAddEmail] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!group) return null;

  if (!isAdmin) {
    return (
      <div style={{ ...card(), padding: "40px 26px", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: T.sub }}>
          Only the group creator can manage settings.
        </p>
      </div>
    );
  }

  const groupColor = group.color || getUserColor(group.name);
  const groupInit = (group.name || "?").trim().slice(0, 2).toUpperCase();
  const nameDirty = name.trim() !== group.name && name.trim().length > 0;

  const saveName = () => {
    if (!nameDirty) return;
    updateGroupMutation.mutate(
      { groupId, payload: { name: name.trim() } },
      {
        onSuccess: () => toast.success("Group renamed"),
        onError: () => toast.error("Failed to update group"),
      }
    );
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const response = await uploadFileMutation.mutateAsync(file);
      if (response.success) {
        updateGroupMutation.mutate(
          { groupId, payload: { imageUrl: response.data.downloadUrl } },
          {
            onSuccess: () => toast.success("Group photo updated"),
            onError: () => toast.error("Failed to update group"),
          }
        );
      }
    } catch {
      toast.error("Failed to upload image");
    }
  };

  const handleAddSomeone = () => {
    const email = addEmail.trim().toLowerCase();
    if (!email) return;
    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email address (e.g. name@example.com)");
      return;
    }
    addMembersMutation.mutate(
      { groupId, memberIdentifier: email },
      {
        onSuccess: () => {
          addFriendMutation.mutate(email, { onError: () => {} });
          toast.success("Added to the group");
          setAddEmail("");
        },
        onError: (error) => toast.error(error?.message || "Failed to add member"),
      }
    );
  };

  const toggleLockRate = (next: boolean) => {
    updateGroupMutation.mutate(
      { groupId, payload: { lockPrice: next } },
      {
        onSuccess: () => toast.success(next ? "Rate locked for this group" : "Rate lock removed"),
        onError: () => toast.error("Failed to update group"),
      }
    );
  };

  const handleDelete = () => {
    deleteGroupMutation.mutate(groupId, {
      onSuccess: () => {
        toast.success("Group deleted");
        router.push("/groups");
      },
      onError: (error: unknown) => {
        const message = (error as { message?: string })?.message ?? "";
        toast.error(
          message.includes("non-zero balance")
            ? "Everyone needs to be settled up before this group can be deleted."
            : message || "Failed to delete group"
        );
      },
    });
  };

  return (
    <div style={{ ...card(), padding: "20px 22px" }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <p style={eyebrow()}>Name</p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              style={fieldStyle}
            />
          </div>
        </div>
        <div>
          <p style={eyebrow()}>Photo &amp; colour</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            {group.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={group.image}
                alt=""
                style={{ width: 44, height: 44, borderRadius: 13, objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              <span style={{ ...avatarChip(groupColor, 44, 13), fontSize: 14, flexShrink: 0 }}>
                {groupInit}
              </span>
            )}
            <label
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: A,
                cursor: uploadFileMutation.isPending ? "default" : "pointer",
                opacity: uploadFileMutation.isPending ? 0.6 : 1,
              }}
            >
              {uploadFileMutation.isPending ? "Uploading…" : "Change photo"}
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                disabled={uploadFileMutation.isPending}
                style={{ display: "none" }}
              />
            </label>
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 20 }} />

      <div style={{ marginBottom: 22 }}>
        <GroupInviteLink groupId={groupId} />
      </div>

      <p style={eyebrow()}>Add someone</p>
      <div style={{ display: "flex", gap: 10, marginTop: 8, marginBottom: 22 }}>
        <input
          value={addEmail}
          onChange={(e) => setAddEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddSomeone()}
          placeholder="Email address"
          disabled={addMembersMutation.isPending}
          style={{ ...fieldStyle, flex: 1 }}
        />
        <button
          type="button"
          onClick={handleAddSomeone}
          disabled={addMembersMutation.isPending || !addEmail.trim()}
          style={{
            borderRadius: 13,
            padding: "12px 20px",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: addMembersMutation.isPending ? "default" : "pointer",
            background: A,
            color: "#0a0a0a",
            border: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          {addMembersMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </button>
      </div>

      <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 20 }} />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 22 }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.bright }}>
            Lock the rate for this group
          </p>
          <p style={{ margin: "5px 0 0", fontSize: 12, lineHeight: 1.55, color: T.sub, maxWidth: 440 }}>
            Freeze the exchange rate when a request is created, so nobody&apos;s share drifts with
            the market before it&apos;s settled.
          </p>
        </div>
        <Toggle on={!!group.lockPrice} onChange={toggleLockRate} label="Lock the rate for this group" />
      </div>

      {!confirmDelete ? (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="w-full flex items-center justify-center gap-2"
          style={{
            borderRadius: 12,
            padding: 11,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            background: "rgba(248,113,113,0.07)",
            color: R,
            border: "1px solid rgba(248,113,113,0.2)",
          }}
        >
          <Icons.trash size={14} /> Delete group
        </button>
      ) : (
        <div>
          <p style={{ margin: "0 0 10px", fontSize: 11.5, color: T.sub, textAlign: "center" }}>
            Only possible once everyone is settled up. This can&apos;t be undone.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="flex-1"
              style={{
                padding: 11,
                background: INSET,
                border: "1px solid rgba(255,255,255,0.09)",
                color: T.main,
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteGroupMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2"
              style={{
                padding: 11,
                background: R,
                border: "none",
                color: "#0a0a0a",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 800,
                cursor: deleteGroupMutation.isPending ? "default" : "pointer",
                fontFamily: "inherit",
                opacity: deleteGroupMutation.isPending ? 0.7 : 1,
              }}
            >
              {deleteGroupMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…
                </>
              ) : (
                "Delete forever"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
