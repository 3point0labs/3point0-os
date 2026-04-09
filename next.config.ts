import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/briefing", destination: "/command", permanent: true },
      { source: "/intelligence", destination: "/broadcast", permanent: true },
      { source: "/sponsors", destination: "/partnerships", permanent: true },
      { source: "/dashboard", destination: "/partnerships", permanent: true },
    ];
  },
};

export default nextConfig;
