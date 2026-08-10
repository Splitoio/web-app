import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // fontFamily: {
      //   sans: ["var(--font-instrument-sans)"],
      // },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
        "mobile-xs": ["0.688rem", { lineHeight: "0.938rem" }],
        "mobile-sm": ["0.813rem", { lineHeight: "1.125rem" }],
        "mobile-base": ["0.938rem", { lineHeight: "1.375rem" }],
        "mobile-lg": ["1rem", { lineHeight: "1.5rem" }],
        "mobile-xl": ["1.125rem", { lineHeight: "1.625rem" }],
        "mobile-2xl": ["1.5rem", { lineHeight: "1.75rem" }],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        // Splito design palette (.design/INDEX.md §1). Mirrors the constants
        // exported from lib/splito-design.tsx — change both together.
        splito: {
          bg: "#0b0b0b",
          panel: "#17171A",
          a: "#22D3EE",
          g: "#34D399",
          r: "#F87171",
          p: "#A78BFA",
          o: "#FB923C",
          b: "#818CF8",
        },
      },
      fontFamily: {
        // Numbers, amounts, addresses and token symbols only.
        mono: ["var(--font-dm-mono)", "DM Mono", "monospace"],
      },
      backgroundImage: {
        "splito-surface": "linear-gradient(145deg,#111 0%,#0d0d0d 100%)",
        "splito-hero": "linear-gradient(135deg,#141414 0%,#0f0f0f 100%)",
      },
      boxShadow: {
        "splito-hero": "0 8px 40px rgba(0,0,0,0.5)",
        "splito-modal": "0 40px 100px rgba(0,0,0,0.8)",
        "splito-dropdown": "0 12px 32px rgba(0,0,0,0.6)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        card: "20px",
        stat: "18px",
        hero: "24px",
        pill: "99px",
      },
      keyframes: {
        fU: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fU: "fU 0.28s ease",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
