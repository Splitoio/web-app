"use client";

import Link from "next/link";
import { formatCurrency } from "@/utils/formatters";
import { formatRelativeTime } from "@/lib/utils";
import { A, Card, Eyebrow, Mono, T, statusColor } from "@/lib/splito-design";
import { Row } from "@/components/shell/row";
import type { DashboardActivityItem } from "@/features/workspaces/api/client";

/** "PARTIALLY_PAID" -> "Partially paid". */
function titleCaseStatus(status: string): string {
  return status.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

/**
 * The dashboard's "Activity" card (design lines 228-238 / 357-365 / 448-457):
 * a status dot, title+meta, and a trailing amount. Shared by the personal and
 * business dashboards since `recentActivity` comes off the same summary
 * endpoint and the row shape doesn't otherwise differ between them.
 */
export function ActivityList({
  activity,
  defaultCurrency,
  viewAllHref,
  viewAllLabel = "View all →",
  emptyLabel = "Nothing here yet.",
  limit = 6,
}: {
  activity: DashboardActivityItem[];
  defaultCurrency: string;
  viewAllHref: string;
  viewAllLabel?: string;
  emptyLabel?: string;
  limit?: number;
}) {
  const items = activity.slice(0, limit);

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <Eyebrow color={T.soft}>Activity</Eyebrow>
        <div style={{ flex: 1 }} />
        <Link href={viewAllHref} style={{ fontSize: 12, fontWeight: 700, color: A }}>
          {viewAllLabel}
        </Link>
      </div>
      <Card style={{ padding: 0 }}>
        {items.length === 0 ? (
          <p style={{ padding: "24px 20px", fontSize: 13, color: T.muted, textAlign: "center", margin: 0 }}>
            {emptyLabel}
          </p>
        ) : (
          items.map((a, i) => (
            <Row
              key={a.id}
              href={a.kind === "request" ? `/requests/${a.id}` : undefined}
              noDivider={i === items.length - 1}
              leading={
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: statusColor(a.status),
                  }}
                />
              }
              title={a.title ?? (a.kind === "request" ? "Payment request" : "Activity")}
              meta={
                a.status
                  ? `${titleCaseStatus(a.status)} · ${formatRelativeTime(new Date(a.createdAt))}`
                  : formatRelativeTime(new Date(a.createdAt))
              }
              trailing={
                a.amount != null ? (
                  <Mono style={{ fontSize: 14, fontWeight: 800, color: T.bright }}>
                    {formatCurrency(a.amount, a.currency ?? defaultCurrency)}
                  </Mono>
                ) : undefined
              }
            />
          ))
        )}
      </Card>
    </div>
  );
}

export { titleCaseStatus };
