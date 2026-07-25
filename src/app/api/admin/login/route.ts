import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { encrypt, setSession } from "@/lib/auth";
import { getClientIp, logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";

const loginSchema = z.object({
  username: z.string().trim().min(3).max(100),
  password: z.string().min(8).max(256),
}).strict();

export async function POST(request: Request) {
  const id = requestId(request.headers);
  try {
    const ip = getClientIp(request.headers);
    const parsed = loginSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Tên đăng nhập hoặc mật khẩu không hợp lệ." }, { status: 400 });
    }
    const username = parsed.data.username.toLowerCase();
    const identityHash = crypto.createHash("sha256").update(username).digest("hex");
    const [ipLimit, userLimit] = await Promise.all([
      rateLimit(`ratelimit:admin:ip:${ip}`, 8, 60_000),
      rateLimit(`ratelimit:admin:user:${identityHash}`, 5, 60_000),
    ]);
    if (!ipLimit.success || !userLimit.success) {
      return NextResponse.json({ error: "Quá nhiều lần thử. Vui lòng thử lại sau." }, { status: 429 });
    }

    const admin = await prisma.adminUser.findUnique({ where: { username } });
    const valid = admin?.active
      ? await bcrypt.compare(parsed.data.password, admin.password_hash)
      : false;
    if (!admin || !valid) {
      return NextResponse.json({ error: "Tên đăng nhập hoặc mật khẩu không đúng." }, { status: 401 });
    }

    const sessionId = `sess_${crypto.randomBytes(24).toString("hex")}`;
    const token = await encrypt({
      type: "admin",
      sessionId,
      username: admin.username,
      userId: admin.id,
      sub: admin.id,
    });
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await prisma.$transaction([
      prisma.adminSession.create({
        data: {
          admin_id: admin.id,
          token_hash: tokenHash,
          ip_address: ip,
          user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1_000),
        },
      }),
      prisma.auditLog.create({
        data: {
          actor_type: "ADMIN",
          actor_id: admin.id,
          action: "ADMIN_LOGIN",
          entity_type: "AdminUser",
          entity_id: admin.id,
          request_id: id,
          after_json: { ip },
        },
      }),
    ]);
    await setSession("admin_session", { type: "admin", sessionId, username: admin.username }, token);
    return NextResponse.json({ success: true });
  } catch (error) {
    logServerError("Admin login error", error, id);
    return NextResponse.json(publicServerError(id), { status: 500 });
  }
}
