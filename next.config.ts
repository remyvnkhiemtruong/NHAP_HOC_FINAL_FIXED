import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  serverExternalPackages: ["sharp", "pdfkit", "exceljs", "archiver"],
  turbopack: { root: process.cwd() },
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "object-src 'none'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https://*.blob.vercel-storage.com",
          "font-src 'self' data:",
          "connect-src 'self' https://*.blob.vercel-storage.com",
          "worker-src 'self' blob:",
          "media-src 'none'",
          ...(isDev ? [] : ["upgrade-insecure-requests"]),
        ].join("; "),
      },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    ];
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
