import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  serverExternalPackages: ["sharp", "pdfkit", "exceljs", "archiver"],
  outputFileTracingExcludes: {
    "/*": ["./storage/**/*"],
  },
  webpack(config) {
    // BullMQ supports an optional Valkey Glide client. This application uses
    // IORedis, so exclude the unused optional transport from server bundles.
    config.resolve.alias["@valkey/valkey-glide"] = false;
    return config;
  },
  turbopack: { root: process.cwd() },
  async headers() {
    const securityHeaders = [
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
