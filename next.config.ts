import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg"],
  outputFileTracingIncludes: {
    "/**": ["./src/generated/**/*"],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
