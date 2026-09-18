/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next dev` only. tools/docs-capture.mjs points app.splito.io at this dev
  // server (Chromium --host-resolver-rules) so the documentation screenshots
  // show real links instead of localhost ones; without this, Next blocks the
  // HMR and /_next requests from that host and the pages never hydrate.
  allowedDevOrigins: ["app.splito.io"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/7.x/**",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/9.x/**",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/splito-prod-public/**",
      },
      {
        hostname: "**",
        pathname: "**",
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
