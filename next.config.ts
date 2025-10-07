import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const normalizePath = (path: string) => path.replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!API_URL) {
      return [];
    }

    try {
      const target = new URL(API_URL);
      const origin = `${target.protocol}//${target.host}`;
      const basePath = normalizePath(target.pathname || "/");
      const destinationPrefix = `${origin}${basePath === "/" ? "" : basePath}`;

      return [
        {
          source: "/api/v1/:path*",
          destination: `${destinationPrefix}/api/v1/:path*`,
        },
      ];
    } catch (error) {
      console.warn("Invalid NEXT_PUBLIC_API_URL provided for rewrites.");
      return [];
    }
  },
};

export default nextConfig;
