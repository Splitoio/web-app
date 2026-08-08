"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useActiveWorkspace } from "@/contexts/workspace";
import { useWorkspaceSummary } from "@/features/workspaces/hooks/use-workspace-summary";
import { useGetStreamsByOrganization } from "@/features/business/hooks/use-streams";
import { useGetInvoicesByOrganization } from "@/features/business/hooks/use-invoices";
import type { WorkspaceSummary } from "@/features/workspaces/api/client";
import type { IncomeStream, Invoice } from "@/features/business/api/client";
import { formatCurrency } from "@/utils/formatters";
import { expiryLabel } from "@/components/requests/request-bits";
import {
  A,
  G,
  R,
  O,
  P,
  B,
  T,
  TYPE,
  MONO,
  Card,
  HeroCard,
  Eyebrow,
  Mono,
  statusColor,
  INSET,
} from "@/lib/splito-design";
import { Row } from "@/components/shell/row";
import { ActivityList, titleCaseStatus } from "@/components/dashboard/activity-list";
import { BusinessDashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

const STREAM_COLORS = [A, G, P, O, B];

function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card style={{ borderRadius: 18, padding: "16px 18px", display: "flex", alignItems: "center" }}>
      <div className="min-w-0 flex-1">
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: T.sub }}>{label}</p>
        <p style={{ margin: "3px 0 0", fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", fontFamily: MONO, color }}>
          {value}
        </p>
      </div>
    </Card>
  );
}

/**
 * Treasury control room (design 244-369), adapted to the real data available:
 * income streams give a genuine currency allocation (no fabricated token
 * breakdown), the approval count and open-request/received figures are real,
 * and there is no payroll-run or budget-line model backing those design
 * elements, so they're left out rather than mocked.
 */
function OrgDashboard({ summary, streams }: { summary: WorkspaceSummary; streams: IncomeStream[] | undefined }) {
  const allocation = useMemo(() => {
    const list = streams ?? [];
    const byCurrency = new Map<string, number>();
    for (const s of list) byCurrency.set(s.currency, (byCurrency.get(s.currency) ?? 0) + s.amount);
    const total = [...byCurrency.values()].reduce((a, b) => a + b, 0);
    return [...byCurrency.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([currency, amount], i) => ({
        currency,
        pct: total > 0 ? (amount / total) * 100 : 0,
        color: STREAM_COLORS[i % STREAM_COLORS.length],
      }));
  }, [streams]);

  const openCount = (summary.countsByStatus.OPEN ?? 0) + (summary.countsByStatus.PARTIALLY_PAID ?? 0);

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-[18px] mb-[18px] items-stretch">
        <HeroCard style={{ padding: 24, position: "relative", overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              top: -60,
              right: -40,
              width: 230,
              height: 230,
              borderRadius: "50%",
              pointerEvents: "none",
              background: `${G}0d`,
            }}
          />
          <div className="flex items-start gap-3.5 flex-wrap" style={{ position: "relative" }}>
            <div className="flex-1 min-w-0">
              <Eyebrow color={G}>Treasury balance</Eyebrow>
              <p style={{ margin: "8px 0 5px", ...TYPE.hero, color: "#fff", lineHeight: 1 }}>
                {formatCurrency(summary.treasury.streamsTotal, summary.treasury.currency)}
              </p>
              <p style={{ margin: 0, fontSize: 12.5, color: T.sub }}>
                {summary.treasury.streamCount} income {summary.treasury.streamCount === 1 ? "entry" : "entries"} logged
              </p>
            </div>
            <Link
              href="/treasury"
              className="abtn"
              style={{
                padding: "8px 14px",
                borderRadius: 11,
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
                background: INSET,
                border: "1px solid rgba(255,255,255,0.1)",
                color: T.muted,
              }}
            >
              Open treasury
            </Link>
          </div>
          {allocation.length > 0 && (
            <>
              <div className="flex gap-[3px]" style={{ height: 10, marginTop: 24 }}>
                {allocation.map((al) => (
                  <span key={al.currency} style={{ width: `${al.pct}%`, borderRadius: 3, background: al.color }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-4" style={{ marginTop: 12 }}>
                {allocation.map((al) => (
                  <div key={al.currency} className="flex items-center gap-[7px]">
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: al.color }} />
                    <Mono style={{ fontSize: 11.5, fontWeight: 700, color: T.soft }}>{al.currency}</Mono>
                    <Mono style={{ fontSize: 11.5, color: T.dim }}>{Math.round(al.pct)}%</Mono>
                  </div>
                ))}
              </div>
            </>
          )}
        </HeroCard>

        <div className="flex flex-col gap-3 min-w-0">
          {summary.approvalQueueCount > 0 && (
            <Card style={{ borderRadius: 18, border: `1px solid ${O}38`, background: `${O}0f`, padding: "17px 19px" }}>
              <Eyebrow color={O}>Waiting on approval</Eyebrow>
              <p style={{ margin: "9px 0 0", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", fontFamily: MONO, color: "#fff" }}>
                {summary.approvalQueueCount}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 11.5, color: T.muted }}>
                {summary.approvalQueueCount === 1 ? "item needs" : "items need"} your sign-off
              </p>
              <Link
                href="/approvals"
                className="btn"
                style={{
                  marginTop: 12,
                  display: "inline-flex",
                  padding: "7px 14px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  background: O,
                  color: "#0a0a0a",
                }}
              >
                Review
              </Link>
            </Card>
          )}
          <Card
            style={{
              flex: 1,
              borderRadius: 18,
              padding: "17px 19px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 14,
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: T.sub }}>
                  Open requests
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", fontFamily: MONO, color: T.bright }}>
                  {openCount}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: T.sub }}>Received</p>
                <p style={{ margin: "3px 0 0", fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", fontFamily: MONO, color: G }}>
                  {formatCurrency(summary.totals.received, summary.totals.currency)}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ActivityList
        activity={summary.recentActivity}
        defaultCurrency={summary.totals.currency}
        viewAllHref="/requests"
        emptyLabel="Nothing yet."
      />
    </div>
  );
}

/**
 * Revenue view for a freelance/studio workspace (design 371-459). No period-
 * over-period revenue history exists on the backend, so the tab-switch/bar-
 * chart is replaced by real stat tiles, and "Module A" becomes the actual
 * open/overdue invoice list rather than a fabricated aging table.
 */
function StudioDashboard({ summary, invoices }: { summary: WorkspaceSummary; invoices: Invoice[] | undefined }) {
  const list = invoices ?? [];
  const openInvoices = list.filter((inv) => inv.status === "SENT" || inv.status === "APPROVED");
  const overdueInvoices = list.filter(
    (inv) => inv.status === "OVERDUE" || (inv.status === "SENT" && new Date(inv.dueDate).getTime() < Date.now())
  );
  const agingRows = [...list]
    .filter((inv) => !["PAID", "CLEARED", "CANCELLED", "DRAFT"].includes(inv.status))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-[18px] mb-5 items-stretch">
        <HeroCard style={{ padding: 24, position: "relative", overflow: "hidden" }}>
          <Eyebrow color={T.muted}>Revenue received</Eyebrow>
          <p style={{ margin: "8px 0 5px", ...TYPE.hero, color: "#fff", lineHeight: 1 }}>
            {formatCurrency(summary.totals.received, summary.totals.currency)}
          </p>
          <p style={{ margin: 0, fontSize: 12.5, color: T.sub }}>
            {summary.totals.requestCount} invoice{summary.totals.requestCount === 1 ? "" : "s"} total ·{" "}
            {openInvoices.length} open
          </p>
        </HeroCard>
        <div className="flex flex-col gap-3 min-w-0">
          <StatTile label="Outstanding" value={formatCurrency(summary.totals.outstanding, summary.totals.currency)} color={A} />
          <StatTile
            label="Overdue"
            value={String(overdueInvoices.length)}
            color={overdueInvoices.length > 0 ? R : T.bright}
          />
        </div>
      </div>

      {agingRows.length > 0 && (
        <Card style={{ borderRadius: 20, padding: "20px 22px", marginBottom: 20 }}>
          <div className="flex items-center mb-4">
            <Eyebrow color={T.soft}>Invoices needing attention</Eyebrow>
            <div style={{ flex: 1 }} />
            <Link href="/requests" style={{ fontSize: 12, fontWeight: 700, color: A }}>
              View all →
            </Link>
          </div>
          {agingRows.map((inv, i) => (
            <Row
              key={inv.id}
              noDivider={i === agingRows.length - 1}
              leading={
                <span
                  style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: statusColor(inv.status) }}
                />
              }
              title={inv.description || `Invoice · ${inv.recipient?.name ?? "Unnamed"}`}
              meta={`${titleCaseStatus(inv.status)} · due ${expiryLabel(inv.dueDate.toISOString())}`}
              trailing={
                <Mono style={{ fontSize: 13, fontWeight: 800, color: T.bright }}>
                  {formatCurrency(inv.amount, inv.currency)}
                </Mono>
              }
            />
          ))}
        </Card>
      )}

      <ActivityList
        activity={summary.recentActivity}
        defaultCurrency={summary.totals.currency}
        viewAllHref="/requests"
        emptyLabel="Nothing yet."
      />
    </div>
  );
}

/**
 * Which arrangement a business workspace gets is data-driven, not a third
 * workspace kind: a workspace with treasury streams or an approval queue
 * reads as an org (design 244-369); one with neither reads as a freelance/
 * studio workspace (design 371-459). See features/workspaces schema — there
 * is no field to key this off other than the data itself.
 */
export function BusinessDashboard() {
  const workspace = useActiveWorkspace();
  const { data: summary, isLoading } = useWorkspaceSummary(workspace.id);

  const variant: "org" | "studio" | null = !summary
    ? null
    : summary.treasury.streamCount > 0 || summary.approvalQueueCount > 0
      ? "org"
      : "studio";

  const { data: streams } = useGetStreamsByOrganization(workspace.id, { enabled: variant === "org" });
  const { data: invoices } = useGetInvoicesByOrganization(variant === "studio" ? workspace.id : "");

  if (isLoading || !summary || variant === null) return <BusinessDashboardSkeleton />;

  return variant === "org" ? (
    <OrgDashboard summary={summary} streams={streams} />
  ) : (
    <StudioDashboard summary={summary} invoices={invoices} />
  );
}
