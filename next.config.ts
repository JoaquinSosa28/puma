import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  // Fast Refresh is on by default; keep React strict mode for dev safety.
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    if (dev) {
      // Fallback watcher when Turbopack/webpack native events are unreliable.
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ["**/node_modules/**", "**/.git/**"],
      };
    }
    return config;
  },
};

export default nextConfig;
