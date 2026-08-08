"use client";

import { X } from "lucide-react";
import { R, T } from "@/lib/splito-design";
import type { FormError } from "@/lib/request-errors";

/**
 * A server-side validation failure, rendered inline on the create form.
 *
 * Deliberately NOT a toast. This is a blocking validation error the user has
 * to act on (add a trustline, fix the address), so it stays until they dismiss
 * it or change the offending field — a 4s auto-dismiss meant anyone reading
 * their own typing missed it entirely. Mirrors the treatment the client-side
 * address check already gets: red border on the field, message beneath it.
 */
export function FormErrorNotice({
  error,
  onDismiss,
}: {
  error: FormError;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="mt-2.5 flex items-start gap-2.5 rounded-xl px-3.5 py-3"
      style={{ background: "rgba(248,113,113,0.10)", border: `1px solid rgba(248,113,113,0.35)` }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold leading-snug" style={{ color: R }}>
          {error.title}
        </p>
        {error.detail && (
          <p className="text-[12px] leading-snug mt-1" style={{ color: T.muted }}>
            {error.detail}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="shrink-0 rounded-md p-0.5 transition-colors hover:bg-white/10"
        style={{ color: T.dim }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
