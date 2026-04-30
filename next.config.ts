import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/**": ["./src/generated/**/*"],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
