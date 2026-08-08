"use client";

import { Eyebrow, T, card } from "@/lib/splito-design";

/**
 * Stand-in body for a route that exists (so the shell, nav and redirects are
 * real) but whose screen has not been built yet. Delete the placeholder when
 * the screen lands — do not build on top of it.
 */
export function ScreenPlaceholder({
  screen,
  designLines,
}: {
  /** The screen's name in .design/INDEX.md §2. */
  screen: string;
  /** Its line range in .design/splito-finance.dc.html. */
  designLines: string;
}) {
  return (
    <div className="fade-up" style={{ ...card(), padding: 26 }}>
      <Eyebrow>Screen goes here</Eyebrow>
      <p style={{ margin: "10px 0 0", fontSize: 15, fontWeight: 700, color: T.bright }}>
        {screen}
      </p>
      <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.sub }}>
        Build to <code>.design/splito-finance.dc.html</code> lines {designLines}.
      </p>
    </div>
  );
}
