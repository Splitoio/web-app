"use client";

import { useId, type ReactNode } from "react";
import Link from "next/link";
import { Lock, RefreshCw, TriangleAlert, Loader2 } from "lucide-react";
import { A, BORDER, O, T, card } from "@/lib/splito-design";
import { useSessionStatus } from "@/contexts/session";

/**
 * The one locked-feature idiom for the logged-out console.
 *
 * Everything a signed-out visitor cannot use renders as REAL UI that is
 * disabled, with an inline reason underneath — never blurred fake data, never a
 * modal that ambushes the first click. It is the same "disabled affordance with
 * a live reason" treatment the create form's submit button already uses
 * (app/page.tsx, components/create/create-request-experience.tsx): a control
 * that refuses a click without saying why reads as broken, and fake data behind
 * a blur reads as a dark pattern.
 *
 *   <LockedFeature label="…" reason="…">  wrap arbitrary real controls
 *   <LockedButton  label="…" reason="…">  the "[ View all requests ]" case
 *   <LockedScreen  title="…" reason="…">  a whole route's body
 *   <GatedScreen   …>                     picks between real / locked / error
 *
 * Copy convention, without exception: "Sign in to <do the thing>".
 *
 * NOTHING here may key off `isAuthenticated` — a failed GET /api/users/me also
 * makes that false, and telling a signed-in user to sign in because the backend
 * hiccuped is worse than showing nothing. Read `useSessionStatus()`
 * (contexts/session.tsx), which separates anonymous from loading from error.
 */

const REASON_COLOR = "rgba(34,211,238,0.75)";

/** The shared reason line. Never rendered on its own — always under the thing it explains. */
function LockReason({
  reason,
  center = false,
  id,
  hidden = false,
}: {
  reason: string;
  center?: boolean;
  id?: string;
  /** The wrapper's accessible name already carries this text — don't say it twice. */
  hidden?: boolean;
}) {
  return (
    <p
      id={id}
      aria-hidden={hidden || undefined}
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
 * `pointer-events:none` alone cannot do either (a keyboard user would still tab
 * straight into it).
 *
 * `inert` ALSO removes the subtree from the accessibility tree, which is why
 * `label` is required rather than optional. Without it a screen-reader user got
 * the reason line and nothing else — a disembodied "Sign in to switch
 * workspaces" with no way to know what control it referred to, on a page whose
 * entire purpose is showing people what the product does. The wrapper therefore
 * names itself and its own unavailability, and the visible reason line is
 * hidden from AT so it isn't announced twice.
 */
export function LockedFeature({
  children,
  label,
  reason,
  className,
  /** Skip the visible reason line when a parent already renders one for the group. */
  hideReason = false,
}: {
  children: ReactNode;
  /** What the locked control IS, e.g. "Workspace switcher". Announced to AT. */
  label: string;
  reason: string;
  className?: string;
  hideReason?: boolean;
}) {
  return (
    <div className={className} role="group" aria-label={`${label}, unavailable. ${reason}`}>
      <div inert style={{ opacity: 0.45 }} className="select-none">
        {children}
      </div>
      {!hideReason && <LockReason reason={reason} hidden />}
    </div>
  );
}

/**
 * A single locked action — the `[ View all requests ]` / "Sign in to see your
 * requests" pair. Styled as the dashed outline the create form already uses for
 * "disabled, and here's why", never as a dimmed solid fill: a 50%-opacity
 * accent fill just looks like a dull button.
 *
 * Not wrapped in `inert`: a disabled <button> keeps its own accessible name, so
 * the reason is attached with aria-describedby instead and both are announced.
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
  const reasonId = useId();
  return (
    <div className={className}>
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-describedby={reasonId}
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
      <LockReason reason={reason} center id={reasonId} />
    </div>
  );
}

/**
 * A whole route's body for a signed-out visitor: the console keeps its chrome
 * (sidebar, topbar, nav all still there and still navigable), and the screen
 * itself says what it is, why it's locked, and offers the two ways out.
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

/**
 * Shown when a session cookie exists but GET /api/users/me failed — the visitor
 * IS signed in as far as anyone can tell, so this must never say "sign in".
 *
 * Retry is a full reload rather than a react-query invalidate: the user request
 * is made once, high in the tree (components/AuthProvider.tsx), and half the
 * screen is already rendered against the assumption it resolved. Re-running the
 * whole page is the honest way to re-ask.
 */
export function SessionErrorScreen({ title }: { title: string }) {
  return (
    <div className="fade-up p-4 lg:p-0">
      <div
        style={{ ...card(), padding: 32, textAlign: "center", maxWidth: 480, margin: "40px auto" }}
      >
        <span
          className="mx-auto mb-4 flex items-center justify-center"
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: "rgba(251,146,60,0.1)",
            border: "1px solid rgba(251,146,60,0.28)",
          }}
        >
          <TriangleAlert size={19} strokeWidth={2} color={O} />
        </span>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.bright }}>
          Couldn&rsquo;t load {title}
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.sub, lineHeight: 1.6 }}>
          We couldn&rsquo;t reach your account just now. You&rsquo;re still signed in — this is on
          our end, not yours.
        </p>
        <div className="flex gap-2.5 justify-center" style={{ marginTop: 18 }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 transition-all hover:opacity-90"
            style={{
              borderRadius: 12,
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 800,
              background: A,
              color: "#0a0a0a",
            }}
          >
            <RefreshCw size={14} strokeWidth={2.5} />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

/** Held while the session answer is still in flight. */
export function ScreenSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-5 w-5 animate-spin" style={{ color: T.muted }} />
    </div>
  );
}

/**
 * Route-level gate. `children` is only ever MOUNTED for a signed-in visitor, so
 * every query the screen owns is gated by simply not existing otherwise — hooks
 * cannot be called conditionally, and passing the element as `children` builds a
 * descriptor without running anything.
 *
 * The three non-authenticated outcomes are deliberately distinct. Folding
 * `error` into `anonymous` is what made a transient /users/me failure blank the
 * whole app with a false "Sign in to …" on eight routes at once.
 */
export function GatedScreen({
  title,
  reason,
  blurb,
  children,
}: {
  title: string;
  reason: string;
  blurb: string;
  children: ReactNode;
}) {
  const status = useSessionStatus();

  if (status === "authenticated") return <>{children}</>;
  if (status === "anonymous") return <LockedScreen title={title} reason={reason} blurb={blurb} />;
  if (status === "error") return <SessionErrorScreen title={title} />;
  return <ScreenSpinner />;
}
