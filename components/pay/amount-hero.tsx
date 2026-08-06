"use client";

import { Card, T } from "@/lib/splito-design";
import { formatCurrency } from "@/utils/formatters";

/**
 * Amount-first, wallet-second — the settled UI direction
 * (".plans/2026-08-06-request-money.md" §"UI direction — settled"). Lowest
 * possible intimidation for a payer who has never used the product and may
 * not think of themselves as a crypto user.
 */
export function AmountHero({
  requesterName,
  amount,
  requestName,
  paidCount,
  totalCount,
}: {
  requesterName: string | null;
  amount: number;
  requestName: string;
  paidCount: number;
  totalCount: number;
}) {
  return (
    <Card className="p-6 sm:p-8 text-center">
      <p className="text-[14px] font-semibold" style={{ color: T.muted }}>
        {requesterName ?? "Someone"} is asking you for
      </p>
      <p
        className="text-[44px] sm:text-[52px] font-black font-mono tracking-[-0.03em] my-1"
        style={{ color: T.bright }}
      >
        {formatCurrency(amount, "USD")}
      </p>
      {requestName && (
        <p className="text-[13.5px] font-medium" style={{ color: T.muted }}>
          for &ldquo;{requestName}&rdquo;
        </p>
      )}
      {totalCount > 1 && (
        <p className="text-[12px] font-semibold mt-4" style={{ color: T.dim }}>
          {paidCount} of {totalCount} people have paid
        </p>
      )}
    </Card>
  );
}
