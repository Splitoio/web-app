"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons, O, RADIUS, T, TYPE, A } from "@/lib/splito-design";
import { pageMetaFor } from "@/lib/shell-nav";
import { useActiveWorkspace } from "@/contexts/workspace";
import { usePageActionsRenderer, usePageTitleOverride } from "@/contexts/page-title";

/**
 * Sticky app header (design 123–139): the current screen's title and subtitle,
 * the notification bell, and the one primary action. Title copy is workspace-
 * aware — see lib/shell-nav.ts.
 *
 * A dynamic detail screen (a group, a request) doesn't have a static entry in
 * lib/shell-nav.ts's tables — it calls usePageTitle() (contexts/page-title.tsx)
 * to override title/subtitle with its own data once loaded. No override falls
 * back to pageMetaFor()'s static section title.
 */
export function Topbar({ hasUnread = false }: { hasUnread?: boolean }) {
  const pathname = usePathname() ?? "/";
  const workspace = useActiveWorkspace();
  const override = usePageTitleOverride();
  const renderActions = usePageActionsRenderer();
  const meta = pageMetaFor(pathname, workspace);
  const title = override?.title ?? meta.title;
  // An empty-string override is how a screen says "no subtitle at all" (as
  // opposed to `undefined`, which falls back to the static section subtitle).
  const subtitle = override?.subtitle ?? meta.subtitle;

  return (
    <div
      className="sticky top-0 z-10"
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(11,11,11,0.95)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div className="flex items-center gap-3.5" style={{ height: 72, padding: "0 30px" }}>
        <div className="min-w-0">
          <h1 style={{ ...TYPE.pageTitle, margin: 0 }}>{title}</h1>
          {subtitle ? (
            <p style={{ margin: "2px 0 0", fontSize: 12, color: T.dim }}>{subtitle}</p>
          ) : null}
        </div>

        <div className="flex-1" />

        {/* This screen's own actions, if it published any — usePageActions(). */}
        {renderActions ? renderActions() : null}

        {/* There is no notifications surface yet — no route, no endpoint, and
            `hasUnread` is never set true. Gated visibly rather than left looking
            live, since a bell that swallows every click reads as broken. */}
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label="Notifications — coming soon"
          title="Notifications are coming soon"
          className="abtn relative flex items-center justify-center transition-all"
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            color: T.muted,
            opacity: 0.55,
            cursor: "not-allowed",
          }}
        >
          {Icons.bell({ size: 16 })}
          {hasUnread && (
            <span
              style={{
                position: "absolute",
                top: 7,
                right: 8,
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: O,
              }}
            />
          )}
        </button>

        <Link
          href="/create"
          className="btn flex items-center gap-[7px] transition-all"
          style={{
            borderRadius: RADIUS.control,
            padding: "10px 17px",
            fontSize: 13,
            fontWeight: 700,
            background: A,
            color: "#0a0a0a",
          }}
        >
          {Icons.plus({ size: 16 })}
          Create
        </Link>
      </div>
    </div>
  );
}
