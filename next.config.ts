import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    optimizeCss: true, // inlines critical CSS, defers the rest
  },
};

export default nextConfig;
