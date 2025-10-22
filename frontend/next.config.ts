// import type { NextConfig } from "next";
/** @type {import('next').NextConfig} */

const DEFAULT_DEV_PROXY = "http://localhost:8000"
const DEFAULT_PROD_PROXY = "https://comply-x.onrender.com"

function resolveProxyTarget() {
  const rawTarget =
    process.env.API_PROXY_TARGET?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    (process.env.NODE_ENV === "development" ? DEFAULT_DEV_PROXY : DEFAULT_PROD_PROXY)

  if (!rawTarget) {
    return undefined
  }

  return rawTarget.replace(/\/+$/, "")
}

const proxyTarget = resolveProxyTarget()

const nextConfig = {
  async rewrites() {
    if (!proxyTarget) {
      return []
    }

    const base = proxyTarget.endsWith("/api") ? proxyTarget.slice(0, -4) : proxyTarget

    return [
      // Forward /api/* from Next.js -> FastAPI backend
      {
        source: "/api/:path*",
        destination: `${base}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig;
