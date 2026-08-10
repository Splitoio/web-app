"use client";

import { Card, T, BORDER } from "@/lib/splito-design";
import { formatCurrency } from "@/utils/formatters";
import type { RequestPayerView } from "@/api-helpers/requests";

/**
 * `RequestPayerView` does carry `name` now (group mode), but this picker
 * deliberately doesn't render it. It only exists for the "opened without a
 * `?payer=` param" fallback — the visitor hasn't proven which payer they are
 * yet, so showing every group member's name here would let anyone holding
 * any one of the per-payer links page through everybody else's identity.
 * Let them pick their own row by amount instead; once `?payer=` (or this
 * picker) pins down which payer they are, that's the only identity ever
 * shown to them.
 */
export function PayerPicker({
  payers,
  onSelect,
}: {
  payers: RequestPayerView[];
  onSelect: (payerId: string) => void;
}) {
  const outstanding = payers.filter((p) => p.status !== "CONFIRMED");

  return (
    <Card className="p-5 sm:p-6">
      <p className="text-[15px] font-extrabold mb-1" style={{ color: T.bright }}>
        Which payment is yours?
      </p>
      <p className="text-[12.5px] mb-4" style={{ color: T.muted }}>
        This request has {payers.length} people paying. Pick your share below.
      </p>
      <div className="space-y-2">
        {outstanding.map((p, i) => (
          <button
            key={p.payerId}
            type="button"
            onClick={() => onSelect(p.payerId)}
            className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-left transition-colors hover:bg-white/5"
            style={{ background: "rgba(255,255,255,0.03)", border: BORDER }}
          >
            <span className="text-[13px] font-semibold" style={{ color: T.body }}>
              Share {i + 1}
            </span>
            <span className="text-[14px] font-bold font-mono" style={{ color: T.bright }}>
              {formatCurrency(p.shareAmount, "USD")}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
