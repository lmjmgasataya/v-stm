import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.io", "*.ngrok-free.dev"],
  experimental: {
    serverActions: {
      // Default is 1MB; imported member sheets (up to 5,000 rows) are sent to the import actions as text.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
