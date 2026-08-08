"use client";

import { card, heroCard } from "@/lib/splito-design";

/** A single pulsing placeholder bar — never a spinner, so nothing shifts once real content lands. */
function Bar({
  w,
  h = 14,
  style = {},
}: {
  w: string | number;
  h?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="animate-pulse"
      style={{ width: w, height: h, borderRadius: 6, background: "rgba(255,255,255,0.06)", ...style }}
    />
  );
}

function TileSkeleton({ height = 108 }: { height?: number }) {
  return <div className="animate-pulse" style={{ ...card(), height }} />;
}

/** Loading state for the personal dashboard — hero, settle-up grid, groups + activity. */
export function PersonalDashboardSkeleton() {
  return (
    <div>
      <div style={{ ...heroCard(), padding: "26px 28px 22px", marginBottom: 18 }} className="animate-pulse">
        <div className="flex items-end gap-9 flex-wrap">
          <div>
            <Bar w={90} h={11} style={{ marginBottom: 10 }} />
            <Bar w={160} h={38} style={{ marginBottom: 10 }} />
            <Bar w={140} h={12} />
          </div>
          <div>
            <Bar w={70} h={11} style={{ marginBottom: 10 }} />
            <Bar w={140} h={38} style={{ marginBottom: 10 }} />
            <Bar w={100} h={12} />
          </div>
        </div>
        <Bar w="100%" h={8} style={{ marginTop: 22, borderRadius: 99 }} />
      </div>

      <Bar w={120} h={11} style={{ marginBottom: 12 }} />
      <div
        className="grid gap-3 mb-6"
        style={{ gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))" }}
      >
        {[0, 1, 2, 3].map((i) => (
          <TileSkeleton key={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
        <div className="grid grid-cols-2 gap-3 content-start">
          {[0, 1, 2, 3].map((i) => (
            <TileSkeleton key={i} height={100} />
          ))}
        </div>
        <TileSkeleton height={244} />
      </div>
    </div>
  );
}

/** Loading state for the business dashboard — used for both the org and studio arrangements. */
export function BusinessDashboardSkeleton() {
  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-[18px] mb-[18px]">
        <div className="animate-pulse" style={{ ...heroCard(), padding: 24, height: 190 }} />
        <div className="flex flex-col gap-3">
          <TileSkeleton height={88} />
          <TileSkeleton height={96} />
        </div>
      </div>
      <TileSkeleton height={220} />
      <div style={{ height: 20 }} />
      <TileSkeleton height={220} />
    </div>
  );
}
