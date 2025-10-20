// import type { NextConfig } from "next";
/** @type {import('next').NextConfig} */

const nextConfig = {
  async rewrites() {
    return [
      // forwards /api/* from Next.js -> FastAPI on :8000
      { source: "/api/:path*", destination: "http://localhost:8000/api/:path*", },
    ];
  },
};

module.exports = nextConfig;
