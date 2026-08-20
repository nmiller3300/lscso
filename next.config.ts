import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/nmiller3300/lscso/main/public/images/**",
      },
    ],
  },
};

export default nextConfig;
