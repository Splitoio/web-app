"use client";

import React from "react";
import { Card, T } from "@/lib/splito-design";
import { RowShell } from "./row";

/** Design's requests/invoices/bills grid — INDEX.md §1 "Common grids". */
export const DEFAULT_DATA_TABLE_COLUMNS = "2.2fr 1fr 1fr 1.1fr 1fr 0.8fr";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Right-align the header + cell — use for trailing numeric/age columns. */
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  rowHref?: (row: T) => string | undefined;
  /** CSS grid-template-columns for both the header and every data row. */
  gridTemplateColumns?: string;
  gap?: number;
  emptyState?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The list-screen table card (design lines 462-496): a surface card, an
 * uppercase column-header row, and `.rw` data rows built on `RowShell`.
 * Columns are fully configurable so the same table can render the requests,
 * invoices, or bills grids — each with its own field shapes.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  rowHref,
  gridTemplateColumns = DEFAULT_DATA_TABLE_COLUMNS,
  gap = 12,
  emptyState,
  className = "",
  style = {},
}: DataTableProps<T>) {
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns,
    gap,
  };

  return (
    <Card className={className} style={{ padding: 0, ...style }}>
      <div
        style={{
          ...gridStyle,
          padding: "13px 22px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {columns.map((c) => (
          <p
            key={c.key}
            style={{
              margin: 0,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: T.dim,
              textAlign: c.align ?? "left",
            }}
          >
            {c.header}
          </p>
        ))}
      </div>

      {rows.length === 0
        ? emptyState != null && (
            <div style={{ padding: "40px 22px", textAlign: "center" }}>{emptyState}</div>
          )
        : rows.map((row, i) => (
            <RowShell
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              href={rowHref?.(row)}
              noDivider={i === rows.length - 1}
              style={{ ...gridStyle, padding: "15px 22px", alignItems: "center" }}
            >
              {columns.map((c) => (
                <div key={c.key} style={{ minWidth: 0, textAlign: c.align ?? "left" }}>
                  {c.render(row)}
                </div>
              ))}
            </RowShell>
          ))}
    </Card>
  );
}
