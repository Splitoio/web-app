/**
 * The documentation's typographic kit.
 *
 * Server components, no client JavaScript: /docs has to render for a partner
 * who is not signed in, on a slow connection, with the screenshots doing the
 * heavy lifting. Colours and radii come from lib/splito-design so the guide
 * ages with the product rather than drifting into its own look.
 */

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { A, G, O, P, T } from "@/lib/splito-design";
import { SHOTS, type ShotName } from "./screenshots";
import { docNeighbours, docPage } from "./nav";

/** Heading and standfirst, both read from nav.ts so they match the sidebar. */
export function PageHeader({ href }: { href: string }) {
  const page = docPage(href);
  if (!page) return null;
  return (
    <header className="mb-9 border-b border-white/[0.07] pb-7">
      <h1 className="text-[30px] sm:text-[36px] font-extrabold leading-[1.1] tracking-[-0.03em] text-white">
        {page.title}
      </h1>
      <p className="mt-3 text-[16px] leading-[1.6] text-[#9a9a9a]">{page.summary}</p>
    </header>
  );
}

/** Previous/next, in the order the sidebar lists the pages. */
export function Pager({ href }: { href: string }) {
  const { prev, next } = docNeighbours(href);
  if (!prev && !next) return null;
  return (
    <nav className="mt-16 grid gap-3 border-t border-white/[0.07] pt-7 sm:grid-cols-2">
      {prev ? (
        <Link
          href={prev.href}
          className="rounded-[14px] border border-white/[0.08] px-4 py-3.5 no-underline transition-colors hover:border-white/20"
        >
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#666]">
            Previous
          </div>
          <div className="mt-1 text-[14.5px] font-semibold text-white">{prev.label}</div>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={next.href}
          className="rounded-[14px] border border-white/[0.08] px-4 py-3.5 text-right no-underline transition-colors hover:border-white/20 sm:col-start-2"
        >
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#666]">Next</div>
          <div className="mt-1 text-[14.5px] font-semibold text-white">{next.label}</div>
        </Link>
      ) : null}
    </nav>
  );
}

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 text-[21px] sm:text-[24px] font-extrabold tracking-[-0.02em] text-white mt-14 mb-4 first:mt-0"
    >
      {/* Explicit colour: globals.css paints bare anchors cyan, which would
          make every heading on the page read as a link. */}
      <a href={`#${id}`} className="text-white no-underline transition-colors hover:text-[#22D3EE]">
        {children}
      </a>
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[16px] font-bold tracking-[-0.01em] text-white mt-9 mb-3">{children}</h3>
  );
}

export function P_({ children }: { children: ReactNode }) {
  return <p className="text-[15px] leading-[1.75] text-[#c9c9c9] my-4">{children}</p>;
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="text-[17px] leading-[1.7] text-[#d8d8d8] mb-8">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="my-4 space-y-2.5 text-[15px] leading-[1.7] text-[#c9c9c9] [&>li]:relative [&>li]:pl-5 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[0.62em] [&>li]:before:h-[5px] [&>li]:before:w-[5px] [&>li]:before:rounded-full [&>li]:before:bg-white/30">
      {children}
    </ul>
  );
}

/**
 * Numbered steps. The number is a real element rather than a CSS counter so a
 * step can hold a screenshot or a callout without the marker drifting.
 */
export function Steps({ items }: { items: { title: string; body?: ReactNode }[] }) {
  return (
    <ol className="my-7 space-y-5">
      {items.map((item, index) => (
        <li key={item.title} className="flex gap-3.5">
          <span className="mt-[1px] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] font-[family-name:var(--font-dm-mono)] text-[12px] font-bold text-white">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold leading-[1.5] text-white">{item.title}</div>
            {item.body ? (
              <div className="mt-1.5 text-[14.5px] leading-[1.7] text-[#bdbdbd] [&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
                {item.body}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-white">{children}</strong>;
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-[6px] border border-white/[0.07] bg-white/[0.05] px-[6px] py-[2px] font-[family-name:var(--font-dm-mono)] text-[13px] text-[#e2e2e2]">
      {children}
    </code>
  );
}

export function Pre({ children, label }: { children: string; label?: string }) {
  return (
    <div className="my-6 overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#0e0e10]">
      {label ? (
        <div className="border-b border-white/[0.06] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#777]">
          {label}
        </div>
      ) : null}
      <pre className="overflow-x-auto px-4 py-4 font-[family-name:var(--font-dm-mono)] text-[12.5px] leading-[1.65] text-[#d4d4d4]">
        {children}
      </pre>
    </div>
  );
}

const CALLOUT_TONES = {
  note: { accent: A, label: "Note" },
  tip: { accent: G, label: "Tip" },
  warn: { accent: O, label: "Careful" },
  gap: { accent: P, label: "Not built yet" },
} as const;

/**
 * `gap` exists because the honest answer is sometimes "the product does not do
 * this yet". Saying so in a box beats prose that quietly describes a screen
 * nobody can reach.
 */
export function Callout({
  tone = "note",
  title,
  children,
}: {
  tone?: keyof typeof CALLOUT_TONES;
  title?: string;
  children: ReactNode;
}) {
  const { accent, label } = CALLOUT_TONES[tone];
  return (
    <div
      className="my-6 rounded-[16px] border p-4 sm:p-5"
      style={{ borderColor: `${accent}33`, background: `${accent}0d` }}
    >
      <div
        className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em]"
        style={{ color: accent }}
      >
        {title ?? label}
      </div>
      <div className="text-[14.5px] leading-[1.7] text-[#cfcfcf] [&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}

/** A screenshot, at its real pixel size, with the caption that explains it. */
export function Figure({
  shot,
  caption,
  width: displayWidth,
}: {
  shot: ShotName;
  caption: string;
  /** "phone" narrows the frame for the 390px captures. */
  width?: "full" | "phone";
}) {
  const { width, height } = SHOTS[shot];
  const isPhone = displayWidth === "phone";
  return (
    <figure className={`my-8 ${isPhone ? "max-w-[300px]" : ""}`}>
      <div className="overflow-hidden rounded-[14px] border border-white/[0.09] bg-[#0e0e10] shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
        <Image
          src={`/docs/${shot}.png`}
          alt={caption}
          width={width}
          height={height}
          sizes={isPhone ? "300px" : "(max-width: 1100px) 100vw, 820px"}
          className="block h-auto w-full"
        />
      </div>
      <figcaption className="mt-2.5 text-[12.5px] leading-[1.6] text-[#8a8a8a]">
        {caption}
      </figcaption>
    </figure>
  );
}

/** Two screenshots side by side on a wide screen, stacked on a narrow one. */
export function FigureRow({ children }: { children: ReactNode }) {
  return (
    <div className="my-8 grid gap-5 sm:grid-cols-2 [&>figure]:my-0">{children}</div>
  );
}

export function Table({
  head,
  rows,
}: {
  /** Omit for a key/value table, where a header row would say nothing. */
  head?: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="my-6 overflow-x-auto rounded-[14px] border border-white/[0.08]">
      <table className="w-full min-w-[520px] border-collapse text-left text-[14px]">
        {head ? (
        <thead>
          <tr className="bg-white/[0.03]">
            {head.map((cell) => (
              <th
                key={cell}
                className="border-b border-white/[0.07] px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#8a8a8a]"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        ) : null}
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="align-top">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="border-b border-white/[0.05] px-4 py-3 leading-[1.6] text-[#c9c9c9] last:border-r-0"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Status chip, coloured the way the product colours the same word. */
export function Status({ children, tone }: { children: ReactNode; tone: string }) {
  return (
    <span
      className="inline-block rounded-full px-2 py-[2px] font-[family-name:var(--font-dm-mono)] text-[11.5px] font-medium"
      style={{ color: tone, background: `${tone}1a`, border: `1px solid ${tone}33` }}
    >
      {children}
    </span>
  );
}

export function DocLink({ href, children }: { href: string; children: ReactNode }) {
  // A path with a file extension is a static asset in public/, not a route.
  // next/link would try to navigate the router to it and 404.
  const external = href.startsWith("http") || /\.[a-z0-9]+$/i.test(href);
  const className =
    "text-[#22D3EE] underline decoration-[#22D3EE]/30 underline-offset-[3px] hover:decoration-[#22D3EE] transition-colors";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/** The card grid on the overview page. */
export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="my-8 grid gap-3 sm:grid-cols-2">{children}</div>;
}

export function NavCard({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[16px] border border-white/[0.08] bg-[linear-gradient(145deg,#111_0%,#0d0d0d_100%)] p-5 no-underline transition-colors hover:border-white/20"
    >
      <div className="mb-1.5 flex items-center gap-2 text-[15px] font-bold text-white">
        {title}
        <span className="text-[#22D3EE] opacity-0 transition-opacity group-hover:opacity-100">
          →
        </span>
      </div>
      <div className="text-[13.5px] leading-[1.6]" style={{ color: T.sub }}>
        {children}
      </div>
    </Link>
  );
}
