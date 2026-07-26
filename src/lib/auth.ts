import crypto from "crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const SESSION_TTL_SECONDS = 24 * 60 * 60;
const JWT_ISSUER = "vvk-admission";
const JWT_AUDIENCE = "vvk-admission-web";

function jwtKey(): Uint8Array {
  const rawSecret = process.env.JWT_SECRET;
  if (!rawSecret || rawSecret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters");
  }
  return new TextEncoder().encode(rawSecret);
}

export type SessionType = "admin" | "student";
export type SessionPayload = JWTPayload & {
  sessionId: string;
  type: SessionType;
  userId?: string;
  admin_id?: string;
  studentId?: string;
  student_id?: string;
  username?: string;
};

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setJti(payload.sessionId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(jwtKey());
}

export async function decrypt(input: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(input, jwtKey(), {
    algorithms: ["HS256"],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
  return payload as SessionPayload;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function getSession(
  cookieName: "admin_session" | "student_session" = "admin_session",
): Promise<SessionPayload | null> {
  const sessionToken = (await cookies()).get(cookieName)?.value;
  if (!sessionToken) return null;
  try {
    const payload = await decrypt(sessionToken);
    if (
      (cookieName === "admin_session" && payload.type !== "admin") ||
      (cookieName === "student_session" && payload.type !== "student")
    ) {
      return null;
    }
    const tokenHash = hashToken(sessionToken);
    if (payload.type === "admin") {
      const dbSession = await prisma.adminSession.findUnique({
        where: { token_hash: tokenHash },
        include: { admin: { select: { active: true, username: true } } },
      });
      if (
        !dbSession ||
        !dbSession.admin.active ||
        dbSession.revoked_at ||
        dbSession.expires_at <= new Date()
      ) {
        return null;
      }
      return {
        ...payload,
        userId: dbSession.admin_id,
        admin_id: dbSession.admin_id,
        username: dbSession.admin.username,
      };
    }

    const dbSession = await prisma.studentAccessSession.findUnique({
      where: { token_hash: tokenHash },
    });
    if (!dbSession || dbSession.revoked_at || dbSession.expires_at <= new Date()) {
      return null;
    }
    return {
      ...payload,
      studentId: dbSession.student_id,
      student_id: dbSession.student_id,
    };
  } catch {
    return null;
  }
}

export async function setSession(
  cookieName: "admin_session" | "student_session",
  _payload: SessionPayload,
  token: string,
): Promise<void> {
  const expires = new Date(Date.now() + SESSION_TTL_SECONDS * 1_000);
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    expires,
    maxAge: SESSION_TTL_SECONDS,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    priority: "high",
  });
}

export async function clearSession(
  cookieName: "admin_session" | "student_session",
): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(cookieName)?.value;
  if (sessionToken) {
    const tokenHash = hashToken(sessionToken);
    try {
      if (cookieName === "admin_session") {
        await prisma.adminSession.updateMany({
          where: { token_hash: tokenHash, revoked_at: null },
          data: { revoked_at: new Date() },
        });
      } else {
        await prisma.studentAccessSession.updateMany({
          where: { token_hash: tokenHash, revoked_at: null },
          data: { revoked_at: new Date() },
        });
      }
    } catch (error) {
      logger.error("Unable to revoke session", { error });
    }
  }
  cookieStore.delete(cookieName);
}
