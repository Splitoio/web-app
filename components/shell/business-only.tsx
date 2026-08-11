"use client";

import { Loader2 } from "lucide-react";
import { Eyebrow, T, card } from "@/lib/splito-design";

/**
 * The shared empty state for the three org-only screens — Approvals, Members,
 * Treasury Log (.design/INDEX.md §5). They are absent from `NAV_PERSONAL`
 * (lib/shell-nav.ts) but are still real top-level routes, so a personal
 * workspace can reach them by typed URL and must land on this instead of the
 * real screen.
 *
 * One component rather than three hand-rolled cards: they drifted apart on
 * copy, width and padding, which is what made the gate look absent on two of
 * them even though every page had one.
 */
export function BusinessOnly({ screen, blurb }: { screen: string; blurb: string }) {
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
        <Eyebrow>Business workspaces only</Eyebrow>
        <p style={{ margin: "10px 0 0", fontSize: 15, fontWeight: 700, color: T.bright }}>
          {screen} lives in a business workspace
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.sub, lineHeight: 1.6 }}>
          {blurb} Switch to a business workspace from the sidebar to pick this up.
        </p>
      </div>
    </div>
  );
}

/**
 * Held while `useIsResolvingWorkspace()` is true. Without it a reload with a
 * business workspace cookie renders `BusinessOnly` for a beat — `active` is
 * the personal stand-in until the workspace list lands (contexts/workspace.tsx,
 * `isResolvingActive`), so the gate fires on a business workspace and the user
 * is told to switch to the one they are already in.
 */
export function WorkspaceResolving() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-5 w-5 animate-spin" style={{ color: T.muted }} />
    </div>
  );
}
