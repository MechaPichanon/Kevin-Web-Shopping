import path from "path";
import type { NextConfig } from "next";
import { API_BASE } from "./lib/api";

// next.config.ts runs in Node at build/start time, so importing the same
// API_BASE used by client code is safe here too (nothing to "inline" —
// it's just a plain env var read, same value either way).
const apiUrl = new URL(API_BASE);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: apiUrl.protocol.replace(":", "") as "http" | "https",
        hostname: apiUrl.hostname,
        port: apiUrl.port,
        pathname: "/uploads/**",
      },
    ],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    workerThreads: true,
  },
};

export default nextConfig;
