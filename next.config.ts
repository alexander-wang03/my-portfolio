import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },

  // Enable experimental features
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb", // Limit the size of the request body
      allowedOrigins: ["*"], // Allow all origins (adjust this as needed)
    },
  },
};

export default nextConfig;