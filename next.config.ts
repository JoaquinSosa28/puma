import type { NextConfig } from "next";
import path from "path";

const isDev = process.env.NODE_ENV === "development";

// Next.js needs inline scripts for hydration; dev additionally needs eval for
// React Refresh. Could be tightened to per-request nonces later.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // HSTS is only meaningful over HTTPS (prod behind the ingress).
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]),
];

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for a small Docker image.
  output: "standalone",
  // Hide the floating Next.js dev-tools button (bottom-left "N") in dev.
  devIndicators: false,
  outputFileTracingRoot: path.join(__dirname),
  // Keep the Mongo driver out of Turbopack route bundles — compiles much faster in dev.
  serverExternalPackages: ["mongodb"],
  reactStrictMode: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  experimental: {
    serverActions: {
      // Behind a reverse proxy (k3s ingress) the request host differs from the
      // origin header — list the public domain(s), comma-separated, in env.
      // Example: SERVER_ACTIONS_ALLOWED_ORIGINS=puma.example.com
      allowedOrigins: process.env.SERVER_ACTIONS_ALLOWED_ORIGINS?.split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    },
    // Client router cache: section switches reuse a ≤60s-old payload instantly
    // instead of refetching; mutations still bust it because their action's
    // revalidatePath re-renders the current route in the same response.
    staleTimes: { dynamic: 60, static: 300 },
  },
};

export default nextConfig;
