import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for a small Docker image.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  // Keep the Mongo driver out of Turbopack route bundles — compiles much faster in dev.
  serverExternalPackages: ["mongodb"],
  reactStrictMode: true,
};

export default nextConfig;
