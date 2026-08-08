"use client";

import React from "react";

// ─── Design tokens ────────────────────────────────────────────────────────────
// Single source of truth for the palette in .design/INDEX.md §1. Screens import
// from here; they never re-type a hex. Mirrored (not duplicated) into CSS custom
// properties in app/globals.css and into tailwind.config.ts under `splito.*`.
// Dark-only — there is no light theme.

/** Cyan — brand accent: primary buttons, links, focus rings, personal workspace. */
export const A = "#22D3EE";
/** Green — positive: cleared / paid / approved, positive net position. */
export const G = "#34D399";
/** Red — negative: overdue / declined / rejected, "you owe". */
export const R = "#F87171";
/** Purple — tertiary: Split type, Solana, groups. */
export const P = "#A78BFA";
/** Orange — pending/warning: partly paid, awaiting approval, unread dot. */
export const O = "#FB923C";
/** Indigo — tertiary 2: Ethereum. */
export const B = "#818CF8";

export const ACCENTS = { A, G, R, P, O, B } as const;
export type AccentKey = keyof typeof ACCENTS;

/** Page background — `html`, `body` and the shell wrapper. */
export const BG = "#0b0b0b";

/** Text ramp, brightest last. */
export const T = {
  faint: "#555",
  faded: "#666",
  dim: "#777",
  sub: "#888",
  muted: "#999",
  mid: "#aaa",
  soft: "#bbb",
  label: "#ccc",
  body: "#d4d4d4",
  main: "#e8e8e8",
  bright: "#f5f5f5",
  white: "#fff",
};

/** Standard card/surface fill — rows, tiles, panels. */
export const SURFACE = "linear-gradient(145deg,#111 0%,#0d0d0d 100%)";
/** Hero/feature panel fill — balance hero, treasury hero, group header. */
export const HERO_SURFACE = "linear-gradient(135deg,#141414 0%,#0f0f0f 100%)";
/** Workspace-switcher / popover panel fill (flat, not a gradient). */
export const PANEL = "#17171A";
/** The most common card border. */
export const BORDER = "1px solid rgba(255,255,255,0.08)";
/** Subtle inset field/panel fill (inputs, chips). */
export const INSET = "rgba(255,255,255,0.05)";

export const RADIUS = {
  card: 20,
  stat: 18,
  hero: 24,
  modal: 28,
  control: 12,
  tile: 15,
  pill: 99,
} as const;

export const SHADOW = {
  hero: "0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
  modal: "0 40px 100px rgba(0,0,0,0.8)",
  dropdown: "0 12px 32px rgba(0,0,0,0.6)",
} as const;

/** DM Mono — every number, amount, address and token symbol. */
export const MONO = "var(--font-dm-mono), 'DM Mono', monospace";

/** Fade-up mount animation (`@keyframes fU`). Spread into a style object. */
export const FADE_UP = "fU 0.28s ease";

/** Named entries from the type scale in INDEX.md §1. */
export const TYPE = {
  hero: { fontSize: 40, fontWeight: 800, fontFamily: MONO, letterSpacing: "-0.035em" },
  figure: { fontSize: 28, fontWeight: 800, fontFamily: MONO, letterSpacing: "-0.03em" },
  pageTitle: { fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff" },
  statValue: { fontSize: 19, fontWeight: 800, fontFamily: MONO, letterSpacing: "-0.02em" },
  rowTitle: { fontSize: 13.5, fontWeight: 700 },
  rowAmount: { fontSize: 14, fontWeight: 800, fontFamily: MONO },
  button: { fontSize: 13, fontWeight: 700 },
  meta: { fontSize: 11.5, fontWeight: 600, color: T.sub },
  navGroup: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: T.faded,
  },
} satisfies Record<string, React.CSSProperties>;

/**
 * Status → accent, per the mapping observed in the design's row data.
 * Anything unrecognised is treated as a draft (dim grey).
 */
export function statusColor(status: string | null | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (/cleared|paid|approved|settled|complete|success/.test(s)) return G;
  if (/overdue|declined|rejected|failed|cancel/.test(s)) return R;
  if (/partly|partial|awaiting|pending|review/.test(s)) return O;
  if (/sent|open|active|requested/.test(s)) return A;
  return T.dim;
}

export const FRIEND_COLORS = [A, P, G, O, "#F472B6", "#FBBF24", B];

export function getUserColor(name: string | null) {
  if (!name) return A;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FRIEND_COLORS[Math.abs(hash) % FRIEND_COLORS.length];
}

/**
 * The 2-letter chip initials the design calls for everywhere a person or
 * workspace gets an avatar (design line 209: 30px chip, 2 letters).
 *
 * "QA Tester" -> "QT", "Jackie" -> "JA", no name -> the email's first two.
 * Kept here rather than per-screen so the same person is never "Q" in the
 * sidebar and "QT" in the members list.
 */
export function initialsFrom(name: string | null | undefined, email?: string | null): string {
  const src = (name || email || "").trim();
  if (!src) return "?";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export const fmt = (n: number): string =>
  `$${+n % 1 === 0 ? Math.abs(+n) : Math.abs(+n).toFixed(2)}`;

// ─── Icons (inline SVG, size 16 default) ───────────────────────────────────────
const Ic = ({
  d,
  size = 18,
  sw = 1.8,
  className,
}: {
  d: string | string[];
  size?: number;
  sw?: number;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {Array.isArray(d) ? (
      d.map((p, i) => <path key={i} d={p} />)
    ) : (
      <path d={d} />
    )}
  </svg>
);

export const Icons = {
  home: (props?: { size?: number; className?: string }) => (
    <Ic d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" size={props?.size ?? 16} className={props?.className} />
  ),
  groups: (props?: { size?: number; className?: string }) => (
    <Ic
      d={[
        "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2",
        "M9 11a4 4 0 100-8 4 4 0 000 8z",
        "M23 21v-2a4 4 0 00-3-3.87",
        "M16 3.13a4 4 0 010 7.75",
      ]}
      size={props?.size ?? 16}
      className={props?.className}
    />
  ),
  friends: (props?: { size?: number; className?: string }) => (
    <Ic
      d={[
        "M12 22a10 10 0 100-20 10 10 0 000 20z",
        "M12 16a4 4 0 100-8 4 4 0 000 8z",
      ]}
      size={props?.size ?? 16}
      className={props?.className}
    />
  ),
  settings: (props?: { size?: number; className?: string }) => (
    <Ic
      d={[
        "M12 15a3 3 0 100-6 3 3 0 000 6z",
        "M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
      ]}
      size={props?.size ?? 16}
      className={props?.className}
    />
  ),
  plus: (props?: { size?: number; className?: string }) => (
    <Ic d="M12 5v14M5 12h14" size={props?.size ?? 18} className={props?.className} />
  ),
  bell: (props?: { size?: number; className?: string }) => (
    <Ic
      d={[
        "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9",
        "M13.73 21a2 2 0 01-3.46 0",
      ]}
      className={props?.className}
    />
  ),
  chevD: (props?: { size?: number; className?: string }) => (
    <Ic d="M6 9l6 6 6-6" size={props?.size ?? 15} className={props?.className} />
  ),
  chevR: (props?: { size?: number; className?: string }) => (
    <Ic d="M9 18l6-6-6-6" size={props?.size ?? 15} className={props?.className} />
  ),
  trash: (props?: { size?: number; className?: string }) => (
    <Ic
      d={["M3 6h18", "M8 6V4h8v2", "M19 6l-1 14H6L5 6"]}
      size={props?.size ?? 15}
      className={props?.className}
    />
  ),
  check: (props?: { size?: number; className?: string }) => (
    <Ic d="M20 6L9 17l-5-5" size={props?.size ?? 15} className={props?.className} />
  ),
  wallet: (props?: { size?: number; className?: string }) => (
    <Ic
      d={[
        "M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z",
        "M16 13h.01",
      ]}
      className={props?.className}
    />
  ),
  userPlus: (props?: { size?: number; className?: string }) => (
    <Ic
      d={[
        "M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2",
        "M8.5 11a4 4 0 100-8 4 4 0 000 8z",
        "M20 8v6",
        "M23 11h-6",
      ]}
      className={props?.className}
    />
  ),
  x: (props?: { size?: number; className?: string }) => (
    <Ic d="M18 6L6 18M6 6l12 12" size={props?.size ?? 16} className={props?.className} />
  ),
  search: (props?: { size?: number; className?: string }) => (
    <Ic
      d={[
        "M11 19a8 8 0 100-16 8 8 0 000 16z",
        "M21 21l-4.35-4.35",
      ]}
      className={props?.className}
    />
  ),
  shield: (props?: { size?: number; className?: string }) => (
    <Ic d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" className={props?.className} />
  ),
  logout: (props?: { size?: number; className?: string }) => (
    <Ic
      d={[
        "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4",
        "M16 17l5-5-5-5",
        "M21 12H9",
      ]}
      className={props?.className}
    />
  ),
  camera: (props?: { size?: number; className?: string }) => (
    <Ic
      d={[
        "M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z",
        "M12 17a4 4 0 100-8 4 4 0 000 8z",
      ]}
      className={props?.className}
    />
  ),
  link: (props?: { size?: number; className?: string }) => (
    <Ic
      d={[
        "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71",
        "M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
      ]}
      size={props?.size ?? 15}
      className={props?.className}
    />
  ),
};

// ─── Shared UI primitives ──────────────────────────────────────────────────────
export const Tag = ({
  children,
  color = A,
  className = "",
}: {
  children: React.ReactNode;
  color?: string;
  className?: string;
}) => (
  <span
    className={className}
    style={{
      fontSize: 10,
      padding: "3px 10px",
      borderRadius: 99,
      fontWeight: 700,
      background: `${color}1a`,
      color,
      border: `1px solid ${color}2a`,
      letterSpacing: "0.02em",
    }}
  >
    {children}
  </span>
);

export const Btn = ({
  children,
  onClick,
  variant = "ghost",
  style = {},
  className = "",
  disabled = false,
  title,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
}) => {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: A, color: "#0a0a0a", border: "none" },
    ghost: {
      background: "rgba(255,255,255,0.06)",
      color: T.body,
      border: "1px solid rgba(255,255,255,0.11)",
    },
    danger: {
      background: "rgba(248,113,113,0.08)",
      color: "#F87171",
      border: "1px solid rgba(248,113,113,0.2)",
    },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`splito-btn ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 12,
        padding: "9px 16px",
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontFamily: "inherit",
        transition: "all 0.2s",
        ...styles[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
};

export const Avatar = ({
  init,
  color,
  size = 38,
  className = "",
}: {
  init: string;
  color: string;
  size?: number;
  className?: string;
}) => (
  <div
    className={className}
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: `${color}1a`,
      border: `2px solid ${color}33`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size > 34 ? 11 : 9,
      fontWeight: 800,
      color,
      flexShrink: 0,
    }}
  >
    {init}
  </div>
);

export const Card = ({
  children,
  style = {},
  className = "",
  id,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  id?: string;
}) => (
  <div
    id={id}
    className={className}
    style={{ ...card(), overflow: "hidden", ...style }}
  >
    {children}
  </div>
);

export const StatBox = ({
  label,
  value,
  color = "#fff",
}: {
  label: string;
  value: string;
  color?: string;
}) => (
  <div>
    <p
      style={{
        color: T.muted,
        fontSize: 11,
        marginBottom: 6,
        fontWeight: 600,
        letterSpacing: "0.05em",
      }}
    >
      {label}
    </p>
    <p
      style={{
        color,
        fontSize: 24,
        fontWeight: 800,
        fontFamily: "'DM Mono',monospace",
        letterSpacing: "-0.03em",
      }}
    >
      {value}
    </p>
  </div>
);

export const SectionLabel = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <p
    className={className}
    style={{
      color: T.soft,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      marginBottom: 14,
    }}
  >
    {children}
  </p>
);

export const BackBtn = ({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`splito-back-btn ${className}`}
    style={{
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      padding: "8px 14px",
      color: T.body,
      fontSize: 13,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 5,
      fontFamily: "inherit",
      flexShrink: 0,
      fontWeight: 600,
      transition: "all 0.2s",
    }}
  >
    ←
  </button>
);

/** Group avatar: 1–4 cells with initials. items: { init, color }[] */
export function GroupAvatar({
  items,
  size = 46,
  radius = 14,
  className = "",
}: {
  items: { init: string; color: string }[];
  size?: number;
  radius?: number;
  className?: string;
}) {
  const members = items.slice(0, 4);
  const count = members.length;
  const cellStyle = (m: { init: string; color: string }) => ({
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: `${m.color}28`,
    color: m.color,
    fontWeight: 800,
    fontSize: Math.round(size * (count === 1 ? 0.38 : count === 2 ? 0.32 : 0.26)),
  });
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {count === 0 && <div style={{ flex: 1, background: "#1e1e1e" }} />}
      {count === 1 && (
        <div style={{ ...cellStyle(members[0]), flex: 1 }}>{members[0].init}</div>
      )}
      {count === 2 && (
        <div style={{ display: "flex", flex: 1 }}>
          {members.map((m, i) => (
            <div
              key={i}
              style={{
                ...cellStyle(m),
                borderRight: i === 0 ? "1px solid rgba(0,0,0,0.3)" : undefined,
              }}
            >
              {m.init}
            </div>
          ))}
        </div>
      )}
      {count >= 3 && (
        <>
          <div
            style={{
              display: "flex",
              flex: 1,
              borderBottom: "1px solid rgba(0,0,0,0.3)",
            }}
          >
            {members.slice(0, 2).map((m, i) => (
              <div
                key={i}
                style={{
                  ...cellStyle(m),
                  borderRight: i === 0 ? "1px solid rgba(0,0,0,0.3)" : undefined,
                }}
              >
                {m.init}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flex: 1 }}>
            {members.slice(2, 4).map((m, i) => (
              <div
                key={i}
                style={{
                  ...cellStyle(m),
                  borderRight:
                    i === 0 && members.length > 3
                      ? "1px solid rgba(0,0,0,0.3)"
                      : undefined,
                }}
              >
                {m.init}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Design helpers ────────────────────────────────────────────────────────────
// Style factories (lowercase) return a plain CSSProperties object, so a screen
// can spread and override: `style={{ ...card(), padding: 22 }}`. The matching
// components (capitalised) are the same thing pre-wrapped when there is nothing
// to override. Screens should reach for one of these before writing a hex.

/** Standard surface card — radius 20, 1px hairline border, 145° gradient fill. */
export function card(overrides: React.CSSProperties = {}): React.CSSProperties {
  return {
    background: SURFACE,
    border: BORDER,
    borderRadius: RADIUS.card,
    ...overrides,
  };
}

/** Hero/feature panel — bigger radius, 135° gradient, drop shadow + top highlight. */
export function heroCard(overrides: React.CSSProperties = {}): React.CSSProperties {
  return {
    background: HERO_SURFACE,
    border: BORDER,
    borderRadius: RADIUS.hero,
    boxShadow: SHADOW.hero,
    ...overrides,
  };
}

/**
 * Section eyebrow — 11px/700 uppercase with 0.1em tracking. The single
 * most-used style in the design; pass a role colour to tint it.
 */
export function eyebrow(color: string = T.soft): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color,
    margin: 0,
  };
}

/** Nav-group header — 10px/800, 0.12em tracking, dimmer than an eyebrow. */
export function navGroupLabel(): React.CSSProperties {
  return { ...TYPE.navGroup, margin: 0 };
}

/** Tinted pill: `<accent>` at 10% fill, 20% border, full-strength text. */
export function pill(color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 10px",
    borderRadius: RADIUS.pill,
    fontSize: 11,
    fontWeight: 700,
    background: `${color}1a`,
    border: `1px solid ${color}33`,
    color,
  };
}

/** Circular initials chip — people, workspaces and tokens all use this. */
export function avatarChip(
  color: string,
  size = 32,
  radius: number | string = "50%"
): React.CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: radius,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: size >= 34 ? 12 : size >= 26 ? 10.5 : 9,
    fontWeight: 800,
    background: `${color}1a`,
    border: `1px solid ${color}38`,
    color,
  };
}

export const HeroCard = ({
  children,
  style = {},
  className = "",
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) => (
  <div className={className} style={{ ...heroCard(), ...style }}>
    {children}
  </div>
);

export const Eyebrow = ({
  children,
  color = T.soft,
  style = {},
  className = "",
}: {
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}) => (
  <p className={className} style={{ ...eyebrow(color), ...style }}>
    {children}
  </p>
);

/**
 * Status pill — coloured dot plus same-coloured label. `color` defaults to the
 * accent `statusColor()` derives from the label, so callers usually pass only
 * the status text.
 */
export const StatusPill = ({
  status,
  color,
  tinted = false,
}: {
  status: string;
  color?: string;
  /** Wrap in the tinted bg+border treatment (type tags, approval tags). */
  tinted?: boolean;
}) => {
  const c = color ?? statusColor(status);
  const label = (
    <>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: c,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 11.5, fontWeight: 700, color: c }}>{status}</span>
    </>
  );
  return tinted ? (
    <span style={pill(c)}>{label}</span>
  ) : (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{label}</span>
  );
};

export const AvatarChip = ({
  init,
  color = A,
  size = 32,
  radius = "50%",
  className = "",
  style = {},
}: {
  init: string;
  color?: string;
  size?: number;
  radius?: number | string;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <span className={className} style={{ ...avatarChip(color, size, radius), ...style }}>
    {init}
  </span>
);

/** 38×22 pill track with an 18px knob — "lock the rate", "require a contract". */
export const Toggle = ({
  on,
  onChange,
  color = A,
  disabled = false,
  label,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  color?: string;
  disabled?: boolean;
  label?: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!on)}
    style={{
      position: "relative",
      width: 38,
      height: 22,
      flexShrink: 0,
      padding: 0,
      borderRadius: RADIUS.pill,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      background: on ? color : "rgba(255,255,255,0.09)",
      border: `1px solid ${on ? color : "rgba(255,255,255,0.12)"}`,
      transition: "all .2s",
    }}
  >
    <span
      style={{
        position: "absolute",
        top: 1,
        left: on ? 18 : 1,
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: on ? "#0a0a0a" : "#888",
        transition: "left .2s",
      }}
    />
  </button>
);

/** Any number, amount, address or token symbol. */
export const Mono = ({
  children,
  style = {},
  className = "",
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) => (
  <span className={className} style={{ fontFamily: MONO, ...style }}>
    {children}
  </span>
);
