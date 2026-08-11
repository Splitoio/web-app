"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useAcceptInvite,
  useDeclineInvite,
  useMyInvites,
} from "@/features/business/hooks/use-invites";
import type { MyInvite } from "@/features/business/api/client";
import { A, Btn, Card, Eyebrow, T, avatarChip, initialsFrom } from "@/lib/splito-design";
import { Row } from "@/components/shell/row";
import { formatRelativeTime } from "@/lib/utils";
import { GatedScreen } from "@/components/shell/locked-feature";

/**
 * `/notifications` — the in-app surface for org invitations. Before this
 * route existed, the emailed `/invite/<token>` link was the ONLY way in; the
 * topbar bell (components/topbar.tsx) and the sidebar's Notifications item
 * (lib/shell-nav.ts) both point here, badged off the same `useMyInvites()`
 * cache this page reads.
 *
 * Accept reuses the same `useAcceptInvite()` mutation `/invite/[token]` uses
 * — one membership-creating code path. Reject is invitee-scoped
 * (`POST /invites/:id/decline`), distinct from the admin-only revoke on the
 * Members screen (`useRevokeInvite`).
 */

const ROLE_LABEL: Record<string, string> = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member" };

function errMsg(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | null)?.message;
  return typeof m === "string" && m.trim() ? m : fallback;
}

function InviteRow({ invite, noDivider }: { invite: MyInvite; noDivider: boolean }) {
  // A dedicated mutation instance per row, not one shared across the list —
  // `isPending` is then scoped to THIS invite for free, with no need to check
  // "is the in-flight mutation's argument this row's id" the way the shared
  // accept/decline modal on the Members screen has to.
  const accept = useAcceptInvite();
  const decline = useDeclineInvite();
  const busy = accept.isPending || decline.isPending;
  const inviter = invite.invitedByName ?? invite.invitedByEmail ?? "Someone";

  return (
    <Row
      noDivider={noDivider}
      leading={<span style={avatarChip(A, 38, 13)}>{initialsFrom(invite.organizationName)}</span>}
      title={invite.organizationName}
      meta={`${ROLE_LABEL[invite.role] ?? invite.role} · Invited by ${inviter} · ${formatRelativeTime(invite.createdAt)}`}
      trailing={
        <div className="flex items-center gap-2">
          <Link
            href={`/invite/${encodeURIComponent(invite.token)}`}
            style={{ fontSize: 12, fontWeight: 700, color: T.soft }}
          >
            View
          </Link>
          <Btn
            variant="ghost"
            disabled={busy}
            onClick={() =>
              decline.mutate(invite.id, {
                onSuccess: () => toast.success(`Declined the invite to ${invite.organizationName}`),
                onError: (err) => toast.error(errMsg(err, "Couldn't decline that invite")),
              })
            }
          >
            {decline.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Reject"}
          </Btn>
          <Btn
            variant="primary"
            disabled={busy}
            onClick={() =>
              accept.mutate(invite.token, {
                onSuccess: (result) =>
                  toast.success(
                    result.alreadyMember
                      ? `You're already in ${result.organizationName}`
                      : `Welcome to ${result.organizationName}`
                  ),
                onError: (err) => toast.error(errMsg(err, "Couldn't accept that invite")),
              })
            }
          >
            {accept.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Accept"}
          </Btn>
        </div>
      }
    />
  );
}

function NotificationsScreen() {
  const { data: invites, isPending, isError, refetch } = useMyInvites();

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-7">
      <Eyebrow color={T.soft}>Pending invites</Eyebrow>
      <Card style={{ padding: 0, marginTop: 12 }}>
        {isPending ? (
          <div className="flex items-center justify-center" style={{ padding: "32px 20px" }}>
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: T.muted }} />
          </div>
        ) : isError ? (
          <div style={{ padding: "24px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>Couldn&apos;t load your invites.</p>
            <button
              type="button"
              onClick={() => refetch()}
              style={{
                marginTop: 10,
                fontSize: 12,
                fontWeight: 700,
                color: A,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        ) : invites.length === 0 ? (
          <p style={{ padding: "24px 20px", fontSize: 13, color: T.muted, textAlign: "center", margin: 0 }}>
            No pending invitations right now.
          </p>
        ) : (
          invites.map((invite, i) => (
            <InviteRow key={invite.id} invite={invite} noDivider={i === invites.length - 1} />
          ))
        )}
      </Card>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <GatedScreen
      title="Notifications"
      reason="Sign in to see your invitations"
      blurb="Organization invites addressed to you land here."
    >
      <NotificationsScreen />
    </GatedScreen>
  );
}
