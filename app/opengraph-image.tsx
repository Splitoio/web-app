import { ImageResponse } from "next/og";

/**
 * The link-preview card for every shared request link. Non-users meet the
 * product here before they meet the app, so it says what the product does —
 * request money — and never mentions splitting.
 * Palette is the app's hardcoded chrome: #0b0b0b background, #22D3EE accent.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Splito — request money in any currency";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#0b0b0b",
          padding: "0 90px",
          color: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#22D3EE",
            marginBottom: 34,
          }}
        >
          splito
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.1,
            maxWidth: 940,
          }}
        >
          Request money in any currency.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: "-0.03em",
            lineHeight: 1.2,
            marginTop: 14,
            color: "rgba(255,255,255,0.62)",
          }}
        >
          Get paid in the one you want.
        </div>
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            marginTop: 48,
            padding: "14px 26px",
            borderRadius: 999,
            border: "1px solid rgba(34,211,238,0.35)",
            background: "rgba(34,211,238,0.10)",
            color: "#22D3EE",
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          Open the link · pay · no signup
        </div>
      </div>
    ),
    size
  );
}
