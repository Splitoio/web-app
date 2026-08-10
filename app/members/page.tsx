"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useActiveWorkspace, useIsResolvingWorkspace } from "@/contexts/workspace";
import { BusinessOnly, WorkspaceResolving } from "@/components/shell/business-only";
import {
  useGetOrganizationMembers,
  useRemoveOrganizationMember,
  useUpdateOrganizationMemberRole,
} from "@/features/business/hooks/use-organizations";
import {
  useCreateOrganizationInvite,
  useGetOrganizationInvites,
  useResendInvite,
  useRevokeInvite,
} from "@/features/business/hooks/use-invites";
import { useGetContractsByOrganization, useCreateContract } from "@/features/business/hooks/use-contracts";
import type { Contract, OrganizationInvite, OrgRole } from "@/features/business/api/client";
import { ContractDetailModal } from "@/components/contract-detail-modal";
import { formatCurrency } from "@/utils/formatters";
import { isValidEmail } from "@/utils/validation";
import {
  A,
  G,
  O,
  R,
  P,
  T,
  Card,
  Icons,
  Toggle,
  AvatarChip,
  eyebrow,
  card,
  pill,
  getUserColor,
  RADIUS,
  INSET,
} from "@/lib/splito-design";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GatedScreen } from "@/components/shell/locked-feature";

type Role = OrgRole;
type Freq = "MONTHLY" | "WEEKLY" | "ONE_TIME";

const FREQS: { value: Freq; label: string }[] = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "ONE_TIME", label: "One-time" },
];

const ROLE_COLOR: Record<Role, string> = { OWNER: A, ADMIN: P, MEMBER: T.dim };
const ROLE_LABEL: Record<Role, string> = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member" };

function initialsFor(name: string | null, email: string | null): string {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function errMsg(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.map((x) => (typeof x === "string" ? x : String(x))).join(". ");
  }
  return fallback;
}

/** Contract status → pill label/colour. A signed contract always wins the label, regardless of `status`. */
function contractStatusMeta(c: Contract): { label: string; color: string } {
  if (c.signedAt) return { label: "Signed", color: G };
  if (c.status === "SENT") return { label: "Awaiting signature", color: O };
  if (c.status === "DRAFT") return { label: "Draft", color: T.dim };
  if (c.status === "REJECTED") return { label: "Rejected", color: R };
  if (c.status === "REVOKED") return { label: "Revoked", color: R };
  return { label: c.status, color: T.dim };
}

function contractPayLabel(c: Contract): string | null {
  if (c.compensationAmount == null) return null;
  const amt = formatCurrency(c.compensationAmount, c.compensationCurrency ?? "USD");
  const suffix = c.paymentFrequency === "MONTHLY" ? " / mo" : c.paymentFrequency === "WEEKLY" ? " / wk" : "";
  return `${amt}${suffix}`;
}

/**
 * An invite's own state, which is NOT the same as a member's. Nobody is seated
 * until they accept, so this is the only truthful thing the screen can say
 * about an invited person — it never claims they were added.
 */
function inviteStatusMeta(invite: OrganizationInvite): { label: string; color: string } {
  if (invite.status === "REVOKED") return { label: "Revoked", color: R };
  if (invite.status === "ACCEPTED") return { label: "Accepted", color: G };
  if (invite.expiresAt.getTime() <= Date.now()) return { label: "Expired", color: R };
  return { label: "Pending", color: O };
}

function expiryLabel(invite: OrganizationInvite): string {
  const date = invite.expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (invite.status === "REVOKED") return "Revoked";
  if (invite.expiresAt.getTime() <= Date.now()) return `Expired ${date}`;
  return `Expires ${date}`;
}

type MemberRow = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  contract?: Contract;
};

function MembersScreen() {
  const workspace = useActiveWorkspace();
  const { user } = useAuthStore();
  const isResolving = useIsResolvingWorkspace();
  const isBusiness = workspace.kind === "business";
  const organizationId = isBusiness ? workspace.id : "";

  const { data: members = [], isLoading: membersLoading } = useGetOrganizationMembers(organizationId);
  const { data: contracts = [], isLoading: contractsLoading } =
    useGetContractsByOrganization(organizationId);

  // Only an OWNER/ADMIN may read the invite list (the endpoint 403s a MEMBER),
  // so the membership fetch has to land before this one is allowed to fire.
  const currentRole = useMemo<Role | null>(
    () => members.find((m) => m.userId === user?.id)?.role ?? null,
    [members, user?.id]
  );
  const currentUserIsAdmin = currentRole === "OWNER" || currentRole === "ADMIN";

  const { data: invites = [], isLoading: invitesLoading } = useGetOrganizationInvites(
    organizationId,
    { enabled: currentUserIsAdmin }
  );

  const createInvite = useCreateOrganizationInvite();
  const revoke = useRevokeInvite();
  const resend = useResendInvite();
  const updateRole = useUpdateOrganizationMemberRole();
  const removeMember = useRemoveOrganizationMember();
  const createContract = useCreateContract();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  // Member, not Admin. Admin can revoke invites, change roles and remove
  // people — that is a deliberate grant, never what you get by not touching
  // the toggle.
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [withContract, setWithContract] = useState(false);
  const [cTitle, setCTitle] = useState("");
  const [cJobTitle, setCJobTitle] = useState("");
  const [cScope, setCScope] = useState("");
  const [cRate, setCRate] = useState("");
  const [cFreq, setCFreq] = useState<Freq>("MONTHLY");
  const [cStart, setCStart] = useState("");
  const [cEnd, setCEnd] = useState("");
  const [cNotice, setCNotice] = useState("");
  const [cClause, setCClause] = useState("");
  const [viewContract, setViewContract] = useState<Contract | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ userId: string; name: string } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<OrganizationInvite | null>(null);

  const resetInvite = () => {
    setEmail("");
    setRole("MEMBER");
    setWithContract(false);
    setCTitle("");
    setCJobTitle("");
    setCScope("");
    setCRate("");
    setCFreq("MONTHLY");
    setCStart("");
    setCEnd("");
    setCNotice("");
    setCClause("");
  };

  const closeInvite = () => {
    setInviteOpen(false);
    resetInvite();
  };

  const openInviteFor = (prefillEmail: string, forceContract: boolean) => {
    setEmail(prefillEmail);
    setWithContract(forceContract);
    setInviteOpen(true);
  };

  const rows = useMemo<MemberRow[]>(
    () =>
      members.map((m) => {
        const contract =
          contracts.find((c) => c.assignedToUserId === m.userId) ??
          contracts.find((c) => c.assignedToEmail.toLowerCase() === m.email?.toLowerCase());
        return {
          userId: m.userId,
          name: m.name || m.email || "Member",
          email: m.email || "",
          role: m.role,
          contract,
        };
      }),
    [members, contracts]
  );

  // An ACCEPTED invite is just a member now, so it belongs in the list above,
  // not in a "pending" surface that would double-count them.
  const openInvites = useMemo(
    () => invites.filter((i) => i.status !== "ACCEPTED"),
    [invites]
  );

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy — the link is in the invite email too");
    }
  };

  const handleSubmitInvite = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return toast.error("Enter an email address");
    if (!isValidEmail(trimmedEmail)) return toast.error("Enter a valid email address");

    if (withContract) {
      if (!cTitle.trim()) return toast.error("Contract name is required");
      const amount = parseFloat(cRate);
      if (!cRate || Number.isNaN(amount)) return toast.error("Payment rate is required");
      if (!cStart) return toast.error("Start date is required");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(`${cStart}T00:00:00`);
      if (start.getTime() < today.getTime()) return toast.error("Start date cannot be in the past");
      if (cEnd) {
        const end = new Date(`${cEnd}T00:00:00`);
        if (end.getTime() <= start.getTime()) return toast.error("End date must be after the start date");
      }
      createContract.mutate(
        {
          organizationId,
          assignedToEmail: trimmedEmail,
          title: cTitle.trim(),
          jobTitle: cJobTitle.trim() || undefined,
          scopeOfWork: cScope.trim() || undefined,
          compensationAmount: amount,
          compensationCurrency: "USD",
          paymentFrequency: cFreq,
          startDate: start.toISOString(),
          endDate: cEnd ? new Date(`${cEnd}T00:00:00`).toISOString() : null,
          noticePeriodDays: cNotice ? parseInt(cNotice, 10) : null,
          specialClause: cClause.trim() || null,
        },
        {
          onSuccess: () => {
            toast.success("Contract sent — they join once they sign");
            closeInvite();
          },
          onError: (err: unknown) => toast.error(errMsg(err, "Failed to create contract")),
        }
      );
      return;
    }

    // ONE request. The invited role is applied at acceptance, so there is no
    // follow-up demote call and nobody is seated before they authenticate.
    createInvite.mutate(
      { organizationId, payload: { email: trimmedEmail, role } },
      {
        onSuccess: () => {
          toast.success(`Invite sent to ${trimmedEmail}`);
          closeInvite();
        },
        onError: (err: unknown) => toast.error(errMsg(err, "Failed to invite")),
      }
    );
  };

  /** A shareable link invite — no email, so it defaults to whatever role is picked. */
  const handleCreateLinkInvite = () => {
    createInvite.mutate(
      { organizationId, payload: { role } },
      {
        onSuccess: (invite) => {
          closeInvite();
          if (invite.inviteUrl) void copyLink(invite.inviteUrl);
          else toast.success("Invite link created");
        },
        onError: (err: unknown) => toast.error(errMsg(err, "Failed to create invite link")),
      }
    );
  };

  const handleRoleChange = (userId: string, next: Role) => {
    updateRole.mutate(
      { organizationId, userId, role: next },
      {
        onSuccess: () => toast.success("Role updated"),
        onError: (err: unknown) => toast.error(errMsg(err, "Failed to update role")),
      }
    );
  };

  const handleRemove = () => {
    if (!removeTarget) return;
    removeMember.mutate(
      { organizationId, userId: removeTarget.userId },
      {
        onSuccess: () => {
          toast.success("Member removed");
          setRemoveTarget(null);
        },
        onError: (err: unknown) => toast.error(errMsg(err, "Failed to remove member")),
      }
    );
  };

  const handleRevoke = () => {
    if (!revokeTarget) return;
    revoke.mutate(revokeTarget.id, {
      onSuccess: () => {
        toast.success("Invite revoked — that link no longer works");
        setRevokeTarget(null);
      },
      onError: (err: unknown) => toast.error(errMsg(err, "Failed to revoke invite")),
    });
  };

  const handleResend = (invite: OrganizationInvite) => {
    resend.mutate(invite.id, {
      onSuccess: (updated) => {
        toast.success(
          invite.kind === "email"
            ? "Invite re-sent — the previous link has stopped working"
            : "New link created — the previous link has stopped working"
        );
        if (invite.kind === "link" && updated.inviteUrl) void copyLink(updated.inviteUrl);
      },
      onError: (err: unknown) => toast.error(errMsg(err, "Failed to resend invite")),
    });
  };

  if (isResolving) return <WorkspaceResolving />;

  if (!isBusiness) {
    return (
      <BusinessOnly
        screen="Members"
        blurb="Access and the contracts that grant it are managed per business."
      />
    );
  }

  const isLoading = membersLoading || contractsLoading;

  return (
    <div style={{ maxWidth: 1200, animation: "fU .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <p style={eyebrow()}>
          {isLoading ? "Loading…" : `${rows.length} member${rows.length !== 1 ? "s" : ""}`}
        </p>
        <div style={{ flex: 1 }} />
        {currentUserIsAdmin && (
          <button
            type="button"
            onClick={() => (inviteOpen ? closeInvite() : setInviteOpen(true))}
            className="btn"
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              padding: "8px 16px",
              borderRadius: 11,
              cursor: "pointer",
              background: A,
              color: "#0a0a0a",
              border: "none",
            }}
          >
            Invite someone
          </button>
        )}
      </div>

      {inviteOpen && (
        <div
          style={{
            borderRadius: 20,
            border: "1px solid rgba(34,211,238,0.22)",
            background: "linear-gradient(145deg,#131316 0%,#0e0e10 100%)",
            padding: "20px 22px",
            marginBottom: 16,
            animation: "fU .25s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff" }}>Invite someone</p>
              <p style={{ margin: "3px 0 0", fontSize: 12.5, color: T.sub }}>
                They join {workspace.name} when they accept — nothing changes here until they do.
              </p>
            </div>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={closeInvite}
              aria-label="Close"
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: T.muted,
                fontSize: 16,
              }}
            >
              ×
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 168px", gap: 12, marginBottom: 18 }}>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contractor@example.com"
                autoFocus
                style={inputStyle}
              />
            </Field>
            <Field label="Role">
              <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 12, background: INSET }}>
                {(["ADMIN", "MEMBER"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={role === r}
                    onClick={() => !withContract && setRole(r)}
                    disabled={withContract}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "8px 6px",
                      borderRadius: 9,
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "inherit",
                      border: "none",
                      cursor: withContract ? "not-allowed" : "pointer",
                      opacity: withContract && role !== r ? 0.4 : 1,
                      background: role === r ? A : "transparent",
                      color: role === r ? "#0a0a0a" : T.muted,
                      transition: "all .15s",
                    }}
                  >
                    {r === "ADMIN" ? "Admin" : "Member"}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
              padding: "15px 17px",
              borderRadius: 15,
              background: "rgba(34,211,238,0.05)",
              border: "1px solid rgba(34,211,238,0.18)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: A }}>Require a signed contract</p>
              <p style={{ margin: "4px 0 0", fontSize: 11.5, lineHeight: 1.55, color: T.muted, maxWidth: 520 }}>
                They only get access once they sign — no contract means no workspace access, ever.
                Signing always makes them a Member; promote to Admin afterward if needed.
              </p>
            </div>
            <Toggle on={withContract} onChange={(next) => { setWithContract(next); if (next) setRole("MEMBER"); }} />
          </div>

          {withContract && (
            <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <p style={eyebrow()}>The contract</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12, marginBottom: 12 }}>
                <Field label="Contract name" small>
                  <input value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="e.g. Content Manager — Jackie" style={inputStyleSm} />
                </Field>
                <Field label="Job title" small>
                  <input value={cJobTitle} onChange={(e) => setCJobTitle(e.target.value)} placeholder="e.g. Content Manager" style={inputStyleSm} />
                </Field>
              </div>

              <Field label="Scope of work" small>
                <textarea
                  value={cScope}
                  onChange={(e) => setCScope(e.target.value)}
                  placeholder="Describe the scope of work…"
                  style={{ ...inputStyleSm, minHeight: 58, resize: "vertical", marginBottom: 12 }}
                />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 12, marginBottom: 12 }}>
                <Field label="Rate" small>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, ...inputStyleSm, padding: "11px 14px" }}>
                    <span style={{ fontSize: 13, color: T.faint, fontFamily: "var(--font-dm-mono),'DM Mono',monospace" }}>$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cRate}
                      onChange={(e) => setCRate(e.target.value)}
                      placeholder="3,000.00"
                      style={{ background: "none", border: "none", outline: "none", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "var(--font-dm-mono),'DM Mono',monospace", width: "100%" }}
                    />
                  </div>
                </Field>
                <Field label="Frequency" small>
                  <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 12, background: INSET }}>
                    {FREQS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        aria-pressed={cFreq === f.value}
                        onClick={() => setCFreq(f.value)}
                        style={{
                          flex: 1,
                          textAlign: "center",
                          padding: "8px 6px",
                          borderRadius: 9,
                          fontSize: 11.5,
                          fontWeight: 700,
                          fontFamily: "inherit",
                          border: "none",
                          cursor: "pointer",
                          background: cFreq === f.value ? A : "transparent",
                          color: cFreq === f.value ? "#0a0a0a" : T.muted,
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                <Field label="Starts" small>
                  <input type="date" value={cStart} onChange={(e) => setCStart(e.target.value)} style={{ ...inputStyleSm, colorScheme: "dark" }} />
                </Field>
                <Field label="Ends" small>
                  <input type="date" value={cEnd} onChange={(e) => setCEnd(e.target.value)} style={{ ...inputStyleSm, colorScheme: "dark" }} placeholder="Open-ended" />
                </Field>
                <Field label="Notice (days)" small>
                  <input type="number" min="0" value={cNotice} onChange={(e) => setCNotice(e.target.value)} placeholder="30" style={inputStyleSm} />
                </Field>
              </div>

              <Field label="Special clause" small>
                <textarea
                  value={cClause}
                  onChange={(e) => setCClause(e.target.value)}
                  placeholder="Any special terms…"
                  style={{ ...inputStyleSm, minHeight: 52, resize: "vertical" }}
                />
              </Field>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  marginTop: 14,
                  padding: "12px 15px",
                  borderRadius: 13,
                  background: "rgba(52,211,153,0.05)",
                  border: "1px solid rgba(52,211,153,0.16)",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: G }} />
                <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: T.mid }}>
                  Requests raised against this contract inherit the rate and cadence. They sign once,
                  then invoices follow automatically.
                </p>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20 }}>
            <button type="button" onClick={closeInvite} className="abtn" style={cancelBtnStyle}>
              Cancel
            </button>
            {!withContract && (
              <button
                type="button"
                onClick={handleCreateLinkInvite}
                disabled={createInvite.isPending}
                className="abtn"
                style={{ ...cancelBtnStyle, color: A, border: "1px solid rgba(34,211,238,0.28)" }}
                title="Creates a link anyone can use to join as the selected role"
              >
                Copy invite link instead
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={handleSubmitInvite}
              disabled={createInvite.isPending || createContract.isPending}
              className="btn"
              style={sendBtnStyle}
            >
              {createInvite.isPending || createContract.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" style={{ display: "inline" }} />
              ) : withContract ? (
                "Create & send"
              ) : (
                "Send invite"
              )}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: T.faded }} />
        </div>
      ) : rows.length === 0 ? (
        <Card style={{ padding: "56px 32px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.bright }}>No members yet</p>
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.sub }}>
            Invite someone above to get started.
          </p>
        </Card>
      ) : (
        <Card style={{ padding: 0 }}>
          {rows.map((m, i) => {
            const color = getUserColor(m.name);
            const contract = m.contract;
            const meta = contract ? contractStatusMeta(contract) : null;
            const pay = contract ? contractPayLabel(contract) : null;
            // Ownership is transferred deliberately, never through this select,
            // and the backend refuses to demote the last OWNER anyway.
            const canManage = currentUserIsAdmin && m.role !== "OWNER";

            return (
              <div
                key={m.userId}
                className="rw"
                style={{
                  padding: "16px 22px",
                  borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <AvatarChip init={initialsFor(m.name, m.email)} color={color} size={38} />
                  <div style={{ width: 186, flexShrink: 0, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.bright, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.name}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.email}
                    </p>
                  </div>

                  {canManage ? (
                    <div style={{ width: 108, flexShrink: 0 }}>
                      <Select value={m.role} onValueChange={(v) => handleRoleChange(m.userId, v as Role)}>
                        <SelectTrigger className="h-7 text-[11px] bg-white/[0.05] text-white border border-white/[0.1] rounded-full px-3 focus:ring-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-splito-a [&>svg]:text-white/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#17171A] border border-white/10 rounded-lg shadow-xl">
                          <SelectItem value="ADMIN" className="text-[12px] text-white hover:bg-white/5 cursor-pointer">Admin</SelectItem>
                          <SelectItem value="MEMBER" className="text-[12px] text-white hover:bg-white/5 cursor-pointer">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <span style={{ ...pill(ROLE_COLOR[m.role]), flexShrink: 0 }}>{ROLE_LABEL[m.role]}</span>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {contract ? (
                      <>
                        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: T.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {contract.title || "Contract"}
                        </p>
                        {pay && (
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: T.dim, fontFamily: "var(--font-dm-mono),'DM Mono',monospace" }}>
                            {pay}
                          </p>
                        )}
                      </>
                    ) : (
                      <p style={{ margin: 0, fontSize: 12.5, color: T.faded }}>No contract</p>
                    )}
                  </div>

                  {meta && <span style={{ ...pill(meta.color), flexShrink: 0 }}>{meta.label}</span>}

                  <button
                    type="button"
                    onClick={() =>
                      contract ? setViewContract(contract) : openInviteFor(m.email, true)
                    }
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "inherit",
                      background: "none",
                      border: "none",
                      color: A,
                      cursor: "pointer",
                      flexShrink: 0,
                      width: 118,
                      textAlign: "right",
                    }}
                  >
                    {contract ? "View contract" : currentUserIsAdmin ? "Add contract" : ""}
                  </button>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setRemoveTarget({ userId: m.userId, name: m.name })}
                      aria-label="Remove member"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        background: "transparent",
                        border: "1px solid rgba(248,113,113,0.25)",
                        color: R,
                        cursor: "pointer",
                      }}
                    >
                      {Icons.x({ size: 12 })}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Invited, but not yet members. Deliberately its own surface: an invite
          creates no account and no membership, so showing these people in the
          list above would claim access they do not have. */}
      {currentUserIsAdmin && (invitesLoading || openInvites.length > 0) && (
        <div style={{ marginTop: 22 }}>
          <p style={eyebrow()}>
            {invitesLoading ? "Invites…" : `${openInvites.length} pending invite${openInvites.length !== 1 ? "s" : ""}`}
          </p>
          {invitesLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: T.faded }} />
            </div>
          ) : (
            <Card style={{ padding: 0, marginTop: 10 }}>
              {openInvites.map((invite, i) => {
                const meta = inviteStatusMeta(invite);
                const label = invite.email ?? "Anyone with the link";
                const contract = invite.contractId
                  ? contracts.find((c) => c.id === invite.contractId)
                  : undefined;
                const busy =
                  (revoke.isPending && revokeTarget?.id === invite.id) ||
                  (resend.isPending && resend.variables === invite.id);

                return (
                  <div
                    key={invite.id}
                    className="rw"
                    style={{
                      padding: "14px 22px",
                      borderBottom: i < openInvites.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <AvatarChip
                        init={invite.email ? initialsFor(null, invite.email) : "∞"}
                        color={getUserColor(label)}
                        size={34}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.bright, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {label}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.sub }}>
                          {contract ? `${contract.title || "Contract"} · ` : ""}
                          {expiryLabel(invite)}
                        </p>
                      </div>

                      <span style={{ ...pill(ROLE_COLOR[invite.role]), flexShrink: 0 }}>
                        {ROLE_LABEL[invite.role]}
                      </span>
                      <span style={{ ...pill(meta.color), flexShrink: 0 }}>{meta.label}</span>

                      <button
                        type="button"
                        onClick={() => handleResend(invite)}
                        disabled={busy}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: "inherit",
                          background: "none",
                          border: "none",
                          color: A,
                          cursor: busy ? "default" : "pointer",
                          flexShrink: 0,
                          width: 118,
                          textAlign: "right",
                        }}
                        title="Sends a fresh link. Any link already copied or emailed for this invite stops working."
                      >
                        {invite.kind === "link" ? "New link" : "Resend"}
                      </button>

                      {invite.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => setRevokeTarget(invite)}
                          aria-label="Revoke invite"
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            background: "transparent",
                            border: "1px solid rgba(248,113,113,0.25)",
                            color: R,
                            cursor: "pointer",
                          }}
                        >
                          {Icons.x({ size: 12 })}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
          <p style={{ margin: "10px 2px 0", fontSize: 12, color: T.dim }}>
            Nobody appears in the member list until they accept. Resending rotates the token, so any
            link copied earlier stops working.
          </p>
        </div>
      )}

      <p style={{ margin: "14px 2px 0", fontSize: 12, color: T.dim }}>
        An agreement sets the rate and cadence. Requests raised against it inherit both.
      </p>

      <ContractDetailModal isOpen={!!viewContract} onClose={() => setViewContract(null)} contract={viewContract} />

      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0" style={{ background: "rgba(0,0,0,0.75)" }} onClick={() => !removeMember.isPending && setRemoveTarget(null)} />
          <div
            className="relative z-10 w-full max-w-sm"
            style={{ ...card({ borderRadius: RADIUS.modal }), padding: 24 }}
          >
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.bright }}>Remove member?</p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: T.body, lineHeight: 1.5 }}>
              <strong style={{ color: T.bright }}>{removeTarget.name}</strong> will lose access to{" "}
              {workspace.name}. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setRemoveTarget(null)} disabled={removeMember.isPending} className="abtn" style={{ ...cancelBtnStyle, flex: 1 }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={removeMember.isPending}
                className="btn"
                style={{ flex: 1, borderRadius: 12, padding: "11px 18px", fontSize: 13, fontWeight: 800, cursor: "pointer", background: "rgba(248,113,113,0.15)", color: R, border: "1px solid rgba(248,113,113,0.3)" }}
              >
                {removeMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" style={{ display: "inline" }} /> : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0" style={{ background: "rgba(0,0,0,0.75)" }} onClick={() => !revoke.isPending && setRevokeTarget(null)} />
          <div
            className="relative z-10 w-full max-w-sm"
            style={{ ...card({ borderRadius: RADIUS.modal }), padding: 24 }}
          >
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.bright }}>Revoke invite?</p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: T.body, lineHeight: 1.5 }}>
              The link sent to{" "}
              <strong style={{ color: T.bright }}>{revokeTarget.email ?? "anyone holding it"}</strong>{" "}
              stops working immediately. They were never a member of {workspace.name}, so nothing
              else changes.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setRevokeTarget(null)} disabled={revoke.isPending} className="abtn" style={{ ...cancelBtnStyle, flex: 1 }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={revoke.isPending}
                className="btn"
                style={{ flex: 1, borderRadius: 12, padding: "11px 18px", fontSize: 13, fontWeight: 800, cursor: "pointer", background: "rgba(248,113,113,0.15)", color: R, border: "1px solid rgba(248,113,113,0.3)" }}
              >
                {revoke.isPending ? <Loader2 className="h-4 w-4 animate-spin" style={{ display: "inline" }} /> : "Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, small = false }: { label: string; children: React.ReactNode; small?: boolean }) {
  return (
    <div>
      <p style={{ margin: `0 0 ${small ? 7 : 8}px`, fontSize: small ? 11.5 : 11, fontWeight: small ? 600 : 700, letterSpacing: small ? undefined : "0.1em", textTransform: small ? undefined : "uppercase", color: small ? T.muted : T.soft }}>
        {label}
      </p>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 13,
  border: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.03)",
  padding: "12px 15px",
  fontSize: 14,
  color: "#fff",
  outline: "none",
  fontFamily: "inherit",
};

const inputStyleSm: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.03)",
  padding: "11px 14px",
  fontSize: 13,
  color: "#fff",
  outline: "none",
  fontFamily: "inherit",
};

const cancelBtnStyle: React.CSSProperties = {
  borderRadius: 12,
  padding: "11px 18px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  background: INSET,
  color: T.muted,
  border: "1px solid rgba(255,255,255,0.1)",
};

const sendBtnStyle: React.CSSProperties = {
  borderRadius: 12,
  padding: "11px 20px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  background: A,
  color: "#0a0a0a",
  border: "none",
};

/**
 * The shell now renders its chrome for signed-out visitors too, so
 * `/members` is reachable without a session. Gate here, above
 * MembersScreen's `useGetOrganizationMembers`/`useGetContractsByOrganization`/
 * `useGetOrganizationInvites` hooks — hooks can't be called conditionally, so
 * the only way to keep those queries from firing for an anonymous visitor is
 * to never mount the component that owns them.
 */
export default function MembersPage() {
  return (
    <GatedScreen
      title="Members"
      reason="Sign in to see members"
      blurb="Who is in this workspace, their role, and the terms they are on."
    >
      <MembersScreen />
    </GatedScreen>
  );
}
