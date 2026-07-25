import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ADMIN_PROTECTED = ["/admin", "/api/admin"];
const ADMIN_PUBLIC = new Set(["/admin/login", "/api/admin/login"]);
const STUDENT_PUBLIC = new Set(["/student/login", "/api/student/access"]);

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "media-src 'none'",
].join("; ");

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Content-Security-Policy", CSP);
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  return response;
}

function jwtKey(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  return secret && secret.length >= 32 ? new TextEncoder().encode(secret) : null;
}

async function verifiedType(token: string | undefined, expected: "admin" | "student") {
  const key = jwtKey();
  if (!token || !key) return false;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: "vvk-admission",
      audience: "vvk-admission-web",
    });
    return payload.type === expected;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const adminProtected = ADMIN_PROTECTED.some(
    (prefix) => path.startsWith(prefix) && !ADMIN_PUBLIC.has(path),
  );
  if (adminProtected) {
    const valid = await verifiedType(request.cookies.get("admin_session")?.value, "admin");
    if (!valid) {
      const response = path.startsWith("/api")
        ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        : NextResponse.redirect(new URL("/admin/login", request.url));
      return applySecurityHeaders(response);
    }
  }

  const studentProtected =
    (path.startsWith("/student") || path.startsWith("/api/student")) &&
    !STUDENT_PUBLIC.has(path);
  if (studentProtected) {
    const valid = await verifiedType(request.cookies.get("student_session")?.value, "student");
    if (!valid) {
      const response = path.startsWith("/api")
        ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        : NextResponse.redirect(new URL("/student/login", request.url));
      return applySecurityHeaders(response);
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
