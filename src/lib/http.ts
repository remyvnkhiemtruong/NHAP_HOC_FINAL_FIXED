import crypto from "crypto";
import { logger } from "@/lib/logger";

const MAX_FORWARDED_IP_LENGTH = 64;

export function getClientIp(headers: Headers): string {
  const hops = Math.max(0, Math.min(3, Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "1", 10) || 0));
  const forwardedChain = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const forwarded =
    forwardedChain && hops > 0 && forwardedChain.length >= hops
      ? forwardedChain[forwardedChain.length - hops]
      : undefined;
  const realIp = hops > 0 ? headers.get("x-real-ip")?.trim() : undefined;
  const candidate = forwarded || realIp || "unknown";
  if (candidate.length > MAX_FORWARDED_IP_LENGTH) return "unknown";
  return /^[0-9a-fA-F:.]+$/.test(candidate) ? candidate : "unknown";
}

export function requestId(headers?: Headers): string {
  const incoming = headers?.get("x-request-id")?.trim();
  if (incoming && /^[A-Za-z0-9._-]{8,80}$/.test(incoming)) return incoming;
  return crypto.randomUUID();
}

export function logServerError(context: string, error: unknown, id: string): void {
  logger.error(context, { requestId: id, error });
}

export function publicServerError(id: string) {
  return {
    error: "Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.",
    code: "INTERNAL_SERVER_ERROR",
    requestId: id,
  };
}
