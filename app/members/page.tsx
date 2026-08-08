"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useActiveWorkspace, useIsResolvingWorkspace } from "@/contexts/workspace";
import { BusinessOnly, WorkspaceResolving } from "@/components/shell/business-only";
import {
  useGetGroupById,
  useAddMembersToGroup,
  useUpdateMemberRole,
  useRemoveMemberFromGroup,
} from "@/features/groups/hooks/use-create-group";
import { useGetContractsByOrganization, useCreateContract } from "@/features/business/hooks/use-contracts";
import type { Contract } from "@/features/business/api/client";
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
} from "@/lib/splito-design";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Role = "OWNER" | "ADMIN" | "MEMBER";
type Freq = "MONTHLY" | "WEEKLY" | "ONE_TIME";

const FREQS: { value: Freq; label: string }[] = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "ONE_TIME", label: "One-time" },
];

const ROLE_COLOR: Record<Role, string> = { OWNER: A, ADMIN: P, MEMBER: T.dim };

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

/**
 * The gating note shown under a row that has no workspace access yet. Only
 * ever shown for people who aren't a GroupUser — a signed contract always
 * creates one, so "hasAccess" and "has a contract row with no note" coincide.
 */
function accessNoteFor(c: Contract): string {
  if (c.status === "REJECTED") return "Rejected the contract, so never joined.";
  if (c.status === "REVOKED") return "Contract revoked — never joined.";
  if (c.status === "DRAFT") return "Not invited yet — the contract is the invitation.";
  return "No access to this workspace until they sign.";
}

function contractPayLabel(c: Contract): string | null {
  if (c.compensationAmount == null) return null;
  const amt = formatCurrency(c.compensationAmount, c.compensationCurrency ?? "USD");
  const suffix = c.paymentFrequency === "MONTHLY" ? " / mo" : c.paymentFrequency === "WEEKLY" ? " / wk" : "";
  return `${amt}${suffix}`;
}

type MemberRow = {
  key: string;
  kind: "member" | "pending";
  userId?: string;
  name: string;
  email: string;
  role: Role | null;
  contract?: Contract;
};

export default function MembersPage() {
  const workspace = useActiveWorkspace();
  const { user } = useAuthStore();
  const isResolving = useIsResolvingWorkspace();
  const isBusiness = workspace.kind === "business";

  const {
    data: group,
    isLoading: groupLoading,
    refetch: refetchGroup,
  } = useGetGroupById(isBusiness ? workspace.id : "", { type: "BUSINESS" });
  const { data: contracts = [], isLoading: contractsLoading } = useGetContractsByOrganization(
    isBusiness ? workspace.id : ""
  );

  const addMembers = useAddMembersToGroup();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMemberFromGroup();
  const createContract = useCreateContract();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("ADMIN");
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

  const resetInvite = () => {
    setEmail("");
    setRole("ADMIN");
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

  const currentUserIsAdmin =
    !!group &&
    !!user &&
    (group.userId === user.id ||
      group.groupUsers.find((gu) => gu.userId === user.id)?.role === "ADMIN");

  const rows = useMemo<MemberRow[]>(() => {
    if (!group) return [];
    const memberUserIds = new Set(group.groupUsers.map((gu) => gu.userId));
    const memberEmails = new Set(
      group.groupUsers.map((gu) => gu.user.email?.toLowerCase()).filter(Boolean)
    );

    const memberRows: MemberRow[] = group.groupUsers.map((gu) => {
      const contract =
        contracts.find((c) => c.assignedToUserId === gu.userId) ??
        contracts.find((c) => c.assignedToEmail.toLowerCase() === gu.user.email?.toLowerCase());
      const isOwner = gu.userId === group.userId;
      return {
        key: gu.userId,
        kind: "member",
        userId: gu.userId,
        name: gu.user.name || gu.user.email || "Member",
        email: gu.user.email || "",
        role: isOwner ? "OWNER" : (gu.role as Role | null) ?? "MEMBER",
        contract,
      };
    });

    // Contracts assigned to someone who hasn't joined yet — dedupe by email,
    // keep the most recent one if the same person was invited more than once.
    const pendingByEmail = new Map<string, Contract>();
    for (const c of contracts) {
      const matched =
        (c.assignedToUserId && memberUserIds.has(c.assignedToUserId)) ||
        memberEmails.has(c.assignedToEmail.toLowerCase());
      if (matched) continue;
      const key = c.assignedToEmail.toLowerCase();
      const existing = pendingByEmail.get(key);
      if (!existing || new Date(c.createdAt) > new Date(existing.createdAt)) {
        pendingByEmail.set(key, c);
      }
    }
    const pendingRows: MemberRow[] = Array.from(pendingByEmail.values()).map((c) => ({
      key: `pending-${c.id}`,
      kind: "pending",
      name: c.assignedTo?.name || c.assignedToEmail,
      email: c.assignedToEmail,
      role: null,
      contract: c,
    }));

    return [...memberRows, ...pendingRows];
  }, [group, contracts]);

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
          organizationId: workspace.id,
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
            toast.success("Contract created — invite email sent");
            closeInvite();
          },
          onError: (err: unknown) => toast.error(errMsg(err, "Failed to create contract")),
        }
      );
      return;
    }

    // No contract: a direct add. The backend always creates business adds as
    // Admin — if Member was picked, downgrade right after, once the fresh
    // group data has the new GroupUser's id.
    addMembers.mutate(
      { groupId: workspace.id, memberIdentifier: trimmedEmail },
      {
        onSuccess: async () => {
          toast.success(role === "ADMIN" ? "Admin invited" : "Member invited");
          if (role === "MEMBER") {
            const fresh = await refetchGroup();
            const gu = fresh.data?.groupUsers.find(
              (g) => g.user.email?.toLowerCase() === trimmedEmail.toLowerCase()
            );
            if (gu) updateRole.mutate({ groupId: workspace.id, userId: gu.userId, role: "MEMBER" });
          }
          closeInvite();
        },
        onError: (err: unknown) => toast.error(errMsg(err, "Failed to invite")),
      }
    );
  };

  const handleRoleChange = (userId: string, next: "ADMIN" | "MEMBER") => {
    updateRole.mutate(
      { groupId: workspace.id, userId, role: next },
      {
        onSuccess: () => toast.success("Role updated"),
        onError: (err: unknown) => toast.error(errMsg(err, "Failed to update role")),
      }
    );
  };

  const handleRemove = () => {
    if (!removeTarget) return;
    removeMember.mutate(
      { groupId: workspace.id, userId: removeTarget.userId },
      {
        onSuccess: () => {
          toast.success("Member removed");
          setRemoveTarget(null);
        },
        onError: (err: unknown) => toast.error(errMsg(err, "Failed to remove member")),
      }
    );
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

  const isLoading = groupLoading || contractsLoading;

  return (
    <div style={{ maxWidth: 940, animation: "fU .3s ease" }}>
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
            padding: "22px 24px",
            marginBottom: 16,
            animation: "fU .25s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff" }}>Invite someone</p>
              <p style={{ margin: "3px 0 0", fontSize: 12.5, color: T.sub }}>
                They join {workspace.name} by email.
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
              <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 12, background: "rgba(255,255,255,0.05)" }}>
                {(["ADMIN", "MEMBER"] as const).map((r) => (
                  <div
                    key={r}
                    onClick={() => !withContract && setRole(r)}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "8px 6px",
                      borderRadius: 9,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: withContract ? "not-allowed" : "pointer",
                      opacity: withContract && role !== r ? 0.4 : 1,
                      background: role === r ? A : "transparent",
                      color: role === r ? "#0a0a0a" : T.muted,
                      transition: "all .15s",
                    }}
                  >
                    {r === "ADMIN" ? "Admin" : "Member"}
                  </div>
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
                  <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 12, background: "rgba(255,255,255,0.05)" }}>
                    {FREQS.map((f) => (
                      <div
                        key={f.value}
                        onClick={() => setCFreq(f.value)}
                        style={{
                          flex: 1,
                          textAlign: "center",
                          padding: "8px 6px",
                          borderRadius: 9,
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: "pointer",
                          background: cFreq === f.value ? A : "transparent",
                          color: cFreq === f.value ? "#0a0a0a" : T.muted,
                        }}
                      >
                        {f.label}
                      </div>
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

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button type="button" onClick={closeInvite} className="abtn" style={cancelBtnStyle}>
              Cancel
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={handleSubmitInvite}
              disabled={addMembers.isPending || createContract.isPending}
              className="btn"
              style={sendBtnStyle}
            >
              {addMembers.isPending || createContract.isPending ? (
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
        <Card style={{ padding: 32, textAlign: "center" }}>
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
            const canManage =
              currentUserIsAdmin && m.kind === "member" && m.role !== "OWNER" && !!m.userId;

            return (
              <div
                key={m.key}
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

                  {m.role ? (
                    canManage && m.userId ? (
                      <div style={{ width: 108, flexShrink: 0 }}>
                        <Select value={m.role} onValueChange={(v) => handleRoleChange(m.userId!, v as "ADMIN" | "MEMBER")}>
                          <SelectTrigger className="h-7 text-[11px] bg-white/[0.05] text-white border border-white/[0.1] rounded-full px-3 focus:ring-0 focus:outline-none [&>svg]:text-white/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#17171A] border border-white/10 rounded-lg shadow-xl">
                            <SelectItem value="ADMIN" className="text-[12px] text-white hover:bg-white/5 cursor-pointer">Admin</SelectItem>
                            <SelectItem value="MEMBER" className="text-[12px] text-white hover:bg-white/5 cursor-pointer">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <span style={{ ...pill(ROLE_COLOR[m.role]), flexShrink: 0 }}>
                        {m.role === "OWNER" ? "Owner" : m.role === "ADMIN" ? "Admin" : "Member"}
                      </span>
                    )
                  ) : (
                    <span style={{ ...pill(T.dim), flexShrink: 0 }}>Invited</span>
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

                  <span
                    onClick={() =>
                      contract ? setViewContract(contract) : openInviteFor(m.email, true)
                    }
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: A,
                      cursor: "pointer",
                      flexShrink: 0,
                      width: 118,
                      textAlign: "right",
                    }}
                  >
                    {contract ? "View contract" : currentUserIsAdmin ? "Add contract" : ""}
                  </span>

                  {canManage && m.userId && (
                    <button
                      type="button"
                      onClick={() => setRemoveTarget({ userId: m.userId!, name: m.name })}
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

                {m.kind === "pending" && contract && (
                  <p style={{ margin: "9px 0 0 52px", fontSize: 11.5, color: O }}>{accessNoteFor(contract)}</p>
                )}
              </div>
            );
          })}
        </Card>
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
  background: "rgba(255,255,255,0.05)",
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
