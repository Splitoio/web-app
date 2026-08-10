"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { A, BORDER, T, card } from "@/lib/splito-design";

/**
 * The one locked-feature idiom for the logged-out console.
 *
 * Everything a signed-out visitor cannot use renders as REAL UI that is
 * disabled, with an inline reason underneath — never blurred fake data, never a
 * modal that ambushes the first click. It is the same "disabled affordance with
 * a live reason" treatment the create form's submit button already uses
 * (app/page.tsx, app/create/page.tsx): a control that refuses a click without
 * saying why reads as broken, and fake data behind a blur reads as a dark
 * pattern.
 *
 * Three entry points, one visual language, so the copy and the styling can
 * never drift apart the way three hand-rolled cards did in shell/business-only.tsx:
 *
 *   <LockedFeature reason="…">   wrap arbitrary real controls
 *   <LockedButton  reason="…">   the "[ View all requests ]" case
 *   <LockedScreen  reason="…">   a whole route's body
 *
 * Copy convention, without exception: "Sign in to <do the thing>".
 */

const REASON_COLOR = "rgba(34,211,238,0.75)";

/** The shared reason line. Never rendered on its own — always under the thing it explains. */
function LockReason({ reason, center = false }: { reason: string; center?: boolean }) {
  return (
    <p
      className={`flex items-center gap-1.5 text-[12px] font-semibold mt-2 ${
        center ? "justify-center" : ""
      }`}
      style={{ color: REASON_COLOR }}
    >
      <Lock size={12} strokeWidth={2.5} className="shrink-0" />
      <span>{reason}</span>
    </p>
  );
}

/**
 * Renders `children` as they normally look, but inert, with `reason` beneath.
 *
 * `inert` (React 19) is what actually disables the subtree: it removes it from
 * the tab order and swallows clicks including on <Link>s, which a `disabled`
 * attribute cannot do (anchors have no disabled state) and which
 * `pointer-events:none` alone cannot do either (a keyboard user would still
 * tab straight into it). Opacity is the visual half only.
 */
export function LockedFeature({
  children,
  reason,
  className,
  /** Skip the reason line when a parent already renders one for the group. */
  hideReason = false,
}: {
  children: ReactNode;
  reason: string;
  className?: string;
  hideReason?: boolean;
}) {
  return (
    <div className={className}>
      <div inert style={{ opacity: 0.45 }} className="select-none">
        {children}
      </div>
      {!hideReason && <LockReason reason={reason} />}
    </div>
  );
}

/**
 * A single locked action — the `[ View all requests ]` / "Sign in to see your
 * requests" pair. Styled as the dashed outline the create form already uses for
 * "disabled, and here's why", never as a dimmed solid fill: a 50%-opacity
 * accent fill just looks like a dull button.
 */
export function LockedButton({
  label,
  reason,
  className,
  fullWidth = true,
}: {
  label: string;
  reason: string;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={className}>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title={reason}
        className={`flex items-center justify-center gap-2 rounded-xl py-3 px-5 text-[14px] font-extrabold cursor-not-allowed ${
          fullWidth ? "w-full" : ""
        }`}
        style={{
          background: "transparent",
          color: "rgba(34,211,238,0.65)",
          border: "1px dashed rgba(34,211,238,0.45)",
        }}
      >
        <Lock size={14} strokeWidth={2.5} />
        {label}
      </button>
      <LockReason reason={reason} center />
    </div>
  );
}

/**
 * A whole route's body for a signed-out visitor: the console keeps its chrome
 * (sidebar, topbar, nav all still there and still navigable), and the screen
 * itself says what it is, why it's locked, and offers the two ways out.
 *
 * `title` names the screen as the nav names it, so the visitor can tell they
 * landed where they clicked.
 */
export function LockedScreen({
  title,
  reason,
  blurb,
}: {
  title: string;
  reason: string;
  /** One sentence on what this screen holds once signed in. */
  blurb: string;
}) {
  return (
    <div className="fade-up p-4 lg:p-0">
      <div
        style={{
          ...card(),
          padding: 32,
          textAlign: "center",
          maxWidth: 480,
          margin: "40px auto",
        }}
      >
        <span
          className="mx-auto mb-4 flex items-center justify-center"
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: "rgba(34,211,238,0.1)",
            border: "1px solid rgba(34,211,238,0.25)",
          }}
        >
          <Lock size={19} strokeWidth={2} color={A} />
        </span>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.bright }}>{title}</p>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.sub, lineHeight: 1.6 }}>{blurb}</p>
        <p
          className="flex items-center justify-center gap-1.5"
          style={{ margin: "14px 0 0", fontSize: 12.5, fontWeight: 700, color: REASON_COLOR }}
        >
          <Lock size={12} strokeWidth={2.5} />
          {reason}
        </p>
        <div className="flex gap-2.5 justify-center" style={{ marginTop: 18 }}>
          <Link
            href="/login"
            className="transition-all hover:opacity-90"
            style={{
              borderRadius: 12,
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 800,
              background: A,
              color: "#0a0a0a",
            }}
          >
            Sign in
          </Link>
          <Link
            href="/"
            className="transition-all hover:border-white/20 hover:text-white"
            style={{
              borderRadius: 12,
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 700,
              color: T.body,
              border: BORDER,
            }}
          >
            Request money
          </Link>
        </div>
      </div>
    </div>
  );
}
