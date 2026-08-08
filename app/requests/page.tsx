"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import { formatCompactAge } from "@/lib/utils";
import { A, T, Card, StatusPill, Mono } from "@/lib/splito-design";
import { DataTable, type DataTableColumn } from "@/components/shell/data-table";
import { listRequests, type RequestListItem, type RequestStatus } from "@/api-helpers/requests";
import { useActiveWorkspace } from "@/contexts/workspace";
import { assetLabel, listRowMeta, listRowType } from "@/components/requests/request-bits";

/**
 * The list-screen table (design 462-496). Filter pills map onto the four
 * RequestStatus values a requester actually acts on — EXPIRED/CANCELLED stay
 * visible under "All" rather than getting their own pill, matching the
 * design's four-pill row.
 */
type FilterKey = "all" | RequestStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "OPEN", label: "Sent" },
  { key: "PARTIALLY_PAID", label: "Partly paid" },
  { key: "SETTLED", label: "Cleared" },
];

/** Design vocabulary (INDEX.md §1) for each RequestStatus — statusColor() derives the dot from this text. */
const STATUS_LABEL: Record<RequestStatus, string> = {
  OPEN: "Sent",
  PARTIALLY_PAID: "Partly paid",
  SETTLED: "Cleared",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv(rows: RequestListItem[], isBusiness: boolean): string {
  const header = ["Title", "Type", "Amount", "Currency", "Settle", "Status", "Created"];
  const lines = rows.map((r) =>
    [
      r.name ?? "",
      listRowType(r.payerCount, isBusiness).label,
      String(r.amount),
      r.denominationCurrency ?? "",
      assetLabel(r.destinationAsset),
      STATUS_LABEL[r.status],
      r.createdAt,
    ]
      .map((v) => csvEscape(String(v)))
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RequestsPage() {
  const workspace = useActiveWorkspace();
  const isBusiness = workspace.kind === "business";
  const [items, setItems] = useState<RequestListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  const load = useCallback(async () => {
    setItems(null);
    setError(null);
    try {
      const res = await listRequests({ limit: 100, workspaceId: workspace.id });
      setItems(res.requests);
    } catch {
      setError("Couldn't load the list.");
    }
  }, [workspace.id]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return filter === "all" ? items : items.filter((r) => r.status === filter);
  }, [items, filter]);

  const handleExport = () => {
    if (!filtered.length) return;
    downloadCsv(
      toCsv(filtered, isBusiness),
      `${isBusiness ? workspace.name.toLowerCase().replace(/\s+/g, "-") : "personal"}-requests.csv`
    );
  };

  const columns: DataTableColumn<RequestListItem>[] = [
    {
      key: "title",
      header: "Title",
      render: (r) => (
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              color: T.bright,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {r.name ?? (r.payerCount > 1 ? "Split request" : "Payment request")}
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 11.5, color: T.sub }}>
            {listRowMeta(r.payerCount, r.paidCount, r.destinationChain)}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (r) => {
        const { label, color } = listRowType(r.payerCount, isBusiness);
        return (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 9px",
              borderRadius: 99,
              background: `${color}1a`,
              color,
              border: `1px solid ${color}33`,
            }}
          >
            {label}
          </span>
        );
      },
    },
    {
      key: "amount",
      header: "Amount",
      render: (r) => (
        <Mono style={{ fontSize: 14, fontWeight: 800, color: T.main }}>
          {formatCurrency(r.amount, r.denominationCurrency || "USD")}
        </Mono>
      ),
    },
    {
      key: "settle",
      header: "Settle",
      render: (r) => (
        <Mono style={{ fontSize: 12.5, fontWeight: 600, color: T.muted }}>
          {assetLabel(r.destinationAsset)}
        </Mono>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={STATUS_LABEL[r.status]} />,
    },
    {
      key: "age",
      header: "Age",
      align: "right",
      render: (r) => (
        <span style={{ fontSize: 12, fontWeight: 600, color: T.sub }}>
          {formatCompactAge(new Date(r.createdAt))}
        </span>
      ),
    },
  ];

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "7px 14px",
                borderRadius: 99,
                cursor: "pointer",
                border: `1px solid ${active ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.1)"}`,
                background: active ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.04)",
                color: active ? A : T.muted,
              }}
            >
              {f.label}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="abtn"
          onClick={handleExport}
          disabled={!filtered.length}
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "7px 14px",
            borderRadius: 11,
            cursor: filtered.length ? "pointer" : "not-allowed",
            opacity: filtered.length ? 1 : 0.5,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            color: T.muted,
            transition: "all .2s",
          }}
        >
          Export CSV
        </button>
      </div>

      {items === null && !error && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: T.muted }} />
        </div>
      )}

      {error && (
        <Card style={{ padding: 26, textAlign: "center" }}>
          <p style={{ fontSize: 13.5, color: T.body, margin: 0 }}>{error}</p>
          <button type="button" onClick={load} className="text-[13px] font-semibold mt-3" style={{ color: A }}>
            Try again
          </button>
        </Card>
      )}

      {items !== null && !error && (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          rowHref={(r) => `/requests/${r.id}`}
          emptyState={
            items.length === 0 ? (
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: T.bright, margin: "0 0 6px" }}>
                  Nothing here yet
                </p>
                <p style={{ fontSize: 13, color: T.muted, margin: "0 0 18px" }}>
                  {isBusiness
                    ? "Requests and invoices for this workspace show up here."
                    : "Every request you create shows up here with its links and who has paid."}
                </p>
                <Link
                  href="/create"
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-extrabold transition-all hover:opacity-90"
                  style={{ background: A, color: "#0a0a0a" }}
                >
                  Create a request <ArrowRight size={15} />
                </Link>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>No requests match this filter.</p>
            )
          }
        />
      )}
    </div>
  );
}
