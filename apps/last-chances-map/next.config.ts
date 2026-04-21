import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@maps-lab/core-schema"],
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
