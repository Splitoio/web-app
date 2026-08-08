"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createGroupInviteLink } from "@/features/groups/api/client";
import { A, T, MONO, eyebrow, INSET } from "@/lib/splito-design";

/**
 * Design's "Invite link" block (gSettings, ~1358-1366): a shareable,
 * expiring link that adds whoever opens it to the group. Wired to the real
 * `POST /groups/:id/invite-link` + `/join?token=` flow (`app/join/page.tsx`).
 */
export function GroupInviteLink({ groupId }: { groupId: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generate = async () => {
    setIsLoading(true);
    try {
      const res = await createGroupInviteLink(groupId);
      setLink(res.inviteLink);
      setExpiresAt(res.expiresAt);
    } catch {
      toast.error("Failed to create invite link");
    } finally {
      setIsLoading(false);
    }
  };

  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied");
  };

  const daysLeft = expiresAt
    ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000))
    : null;

  const buttonStyle: React.CSSProperties = {
    borderRadius: 13,
    padding: "12px 18px",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: isLoading ? "default" : "pointer",
    background: INSET,
    color: T.body,
    border: "1px solid rgba(255,255,255,0.1)",
    fontFamily: "inherit",
    flexShrink: 0,
  };

  return (
    <div>
      <p style={eyebrow()}>Invite link</p>
      {link ? (
        <>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <div
              style={{
                flex: 1,
                borderRadius: 13,
                border: "1px solid rgba(255,255,255,0.09)",
                background: "rgba(255,255,255,0.03)",
                padding: "12px 15px",
                fontSize: 13,
                color: T.body,
                fontFamily: MONO,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              {link}
            </div>
            <button type="button" onClick={copy} style={buttonStyle}>
              Copy
            </button>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: T.dim }}>
            {daysLeft != null && `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} · `}
            <span onClick={generate} style={{ color: A, cursor: "pointer", fontWeight: 600 }}>
              Regenerate
            </span>
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={generate}
          disabled={isLoading}
          style={{ ...buttonStyle, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create invite link"}
        </button>
      )}
    </div>
  );
}
