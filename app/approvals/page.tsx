"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { A, G, MONO, T, Card, Btn, Tag, AvatarChip, getUserColor, Eyebrow, card } from "@/lib/splito-design";
import { useActiveWorkspace, useIsResolvingWorkspace } from "@/contexts/workspace";
import { BusinessOnly, WorkspaceResolving } from "@/components/shell/business-only";
import { isWorkspaceAdmin } from "@/lib/workspace";
import {
  getInvoicesByOrganization,
  approveInvoice,
  declineInvoice,
  type Invoice,
} from "@/features/business/api/client";
import { formatCurrency } from "@/utils/formatters";

/** Approvable states — mirrors the backend's own check (invoice.controller.ts approveInvoice/declineInvoice). */
const PENDING_STATUSES = new Set(["DRAFT", "SENT"]);

function initialsOf(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : trimmed.slice(0, 2)).toUpperCase();
}

function formatDueDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

/**
 * Approvals (design 499-523). Business workspaces only — the nav item itself
 * is already absent from the personal sidebar (navGroupsFor in shell-nav.ts),
 * this is the direct-navigation fallback.
 */
export default function ApprovalsPage() {
  const workspace = useActiveWorkspace();
  const isResolving = useIsResolvingWorkspace();
  const isBusiness = workspace.kind === "business";
  // Approve/decline is OWNER/ADMIN only on the backend (invoice.controller.ts
  // approveInvoice/declineInvoice) — MEMBER never sees the queue, not just a
  // disabled button, matching Members/Treasury/Approvals being admin-only
  // screens rather than admin-only actions on a shared screen.
  const isAdmin = isWorkspaceAdmin(workspace);

  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isBusiness || !isAdmin) return;
    setInvoices(null);
    setError(null);
    try {
      const all = await getInvoicesByOrganization(workspace.id);
      setInvoices(all.filter((inv) => PENDING_STATUSES.has(inv.status)));
    } catch {
      setError("Couldn't load approvals.");
    }
  }, [workspace.id, isBusiness, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  if (isResolving) return <WorkspaceResolving />;

  if (!isBusiness) {
    return (
      <BusinessOnly
        screen="Approvals"
        blurb="Approvals apply to invoices raised inside a business workspace."
      />
    );
  }

  if (!isAdmin) {
    return (
      <div className="fade-up p-4 lg:p-0">
        <div style={{ ...card(), padding: 32, textAlign: "center", maxWidth: 480, margin: "40px auto" }}>
          <Eyebrow>Owners and admins only</Eyebrow>
          <p style={{ margin: "10px 0 0", fontSize: 15, fontWeight: 700, color: T.bright }}>
            Approving invoices isn&apos;t open to members
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.sub, lineHeight: 1.6 }}>
            Ask an owner or admin of {workspace.name} to review what&apos;s pending.
          </p>
        </div>
      </div>
    );
  }

  const handleApprove = async (inv: Invoice) => {
    setBusyId(inv.id);
    try {
      await approveInvoice(inv.id);
      setInvoices((cur) => cur?.filter((i) => i.id !== inv.id) ?? cur);
      toast.success("Approved");
    } catch {
      toast.error("Couldn't approve — try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (inv: Invoice) => {
    const note = window.prompt("Add a note for declining (optional):");
    if (note === null) return; // cancelled the prompt
    setBusyId(inv.id);
    try {
      await declineInvoice(inv.id, note || undefined);
      setInvoices((cur) => cur?.filter((i) => i.id !== inv.id) ?? cur);
      toast.success("Declined");
    } catch {
      toast.error("Couldn't decline — try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fade-up" style={{ maxWidth: 1000 }}>
      {invoices === null && !error && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: T.muted }} />
        </div>
      )}

      {error && (
        <Card style={{ padding: "48px 26px", textAlign: "center" }}>
          <p style={{ fontSize: 13.5, color: T.body, margin: 0 }}>{error}</p>
          <button type="button" onClick={load} className="text-[13px] font-semibold mt-3" style={{ color: A }}>
            Try again
          </button>
        </Card>
      )}

      {invoices !== null && !error && invoices.length === 0 && (
        <Card style={{ padding: "56px 26px", textAlign: "center" }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: T.bright, margin: 0 }}>All caught up</p>
          <p style={{ fontSize: 12.5, color: T.sub, margin: "6px 0 0" }}>
            Nothing needs your approval right now.
          </p>
        </Card>
      )}

      {invoices !== null &&
        invoices.map((inv) => (
          <Card key={inv.id} style={{ padding: "20px 22px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <AvatarChip
                init={initialsOf(inv.issuer?.name)}
                color={getUserColor(inv.issuer?.name ?? null)}
                size={40}
                radius={13}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4, flexWrap: "wrap" }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.bright }}>
                    {inv.description?.trim() || `Invoice from ${inv.issuer?.name ?? "a member"}`}
                  </p>
                  <Tag color={A}>Invoice</Tag>
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: T.sub }}>
                  {inv.issuer?.name ?? "Unknown"} · Due {formatDueDate(inv.dueDate)}
                </p>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 800,
                  fontFamily: MONO,
                  color: T.white,
                  flexShrink: 0,
                }}
              >
                {formatCurrency(inv.amount, inv.currency)}
              </p>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 18,
                paddingTop: 16,
                borderTop: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span style={{ fontSize: 11.5, color: T.sub }}>{inv.description?.trim() || "No note attached"}</span>
              <div style={{ flex: 1 }} />
              <Btn variant="ghost" onClick={() => handleDecline(inv)} disabled={busyId === inv.id}>
                Decline with a note
              </Btn>
              <Btn
                variant="primary"
                onClick={() => handleApprove(inv)}
                disabled={busyId === inv.id}
                style={{ background: G, color: "#0a0a0a" }}
              >
                Approve
              </Btn>
            </div>
          </Card>
        ))}
    </div>
  );
}
