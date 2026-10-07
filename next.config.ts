import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The sales demo is a self-contained page in /public. This serves it at
  // /demo (instead of /demo.html) without needing a route or any React.
  async rewrites() {
    return [{ source: "/demo", destination: "/demo.html" }];
  },
};

export default nextConfig;