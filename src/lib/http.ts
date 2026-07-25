import crypto from "crypto";

const MAX_FORWARDED_IP_LENGTH = 64;

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers.get("x-real-ip")?.trim();
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
  console.error(`[${id}] ${context}`, error);
}

export function publicServerError(id: string) {
  return {
    error: "Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.",
    code: "INTERNAL_SERVER_ERROR",
    requestId: id,
  };
}
