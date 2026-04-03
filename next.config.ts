import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/meeting-ai-assistant",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
