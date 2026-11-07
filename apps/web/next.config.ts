import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@vectorshift/graph"],
  poweredByHeader: false,
};

export default nextConfig;
