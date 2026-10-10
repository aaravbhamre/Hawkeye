import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Request-scoped analysis; no shared application data cache.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
