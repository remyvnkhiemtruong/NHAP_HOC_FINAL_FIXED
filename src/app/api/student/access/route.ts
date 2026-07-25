import crypto from "crypto";
import { NextResponse } from "next/server";
import { encrypt, setSession } from "@/lib/auth";
import { getClientIp, logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { profileSeedRows } from "@/lib/student/profileSeed";
import { parseStudentAccessPayload } from "@/lib/validations/studentAccess";

export async function POST(request: Request) {
  const id = requestId(request.headers);
  try {
    const ip = getClientIp(request.headers);
    const payload = parseStudentAccessPayload(await request.json().catch(() => null));
    if (!payload) {
      return NextResponse.json(
        { error: "CCCD phải đủ 12 số và ngày sinh phải có định dạng ddmmyyyy.", code: "INVALID_ACCESS_PAYLOAD" },
        { status: 400 },
      );
    }

    const ipLimit = await rateLimit(
      `ratelimit:student:ip:${ip}`,
      Number.parseInt(process.env.STUDENT_LOGIN_IP_LIMIT ?? "1200", 10),
      60_000,
    );
    const identityKey = crypto.createHash("sha256").update(payload.cccd).digest("hex");
    const identityLimit = await rateLimit(
      `ratelimit:student:identity:${identityKey}`,
      Number.parseInt(process.env.STUDENT_LOGIN_IDENTITY_LIMIT ?? "5", 10),
      10 * 60_000,
    );
    if (!ipLimit.success || !identityLimit.success) {
      return NextResponse.json(
        { error: "Quá nhiều lần thử. Vui lòng chờ rồi thử lại.", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    const genericError =
      "Số CCCD hoặc ngày sinh không khớp với danh sách trúng tuyển. Vui lòng kiểm tra lại hoặc liên hệ nhà trường.";
    if (payload.cccd === "0") return NextResponse.json({ error: genericError }, { status: 401 });

    const student = await prisma.student.findUnique({
      where: { current_cccd: payload.cccd },
      include: { admission_record: true },
    });
    if (
      !student ||
      student.current_dob !== payload.dob ||
      student.status === "NEEDS_CCCD_CORRECTION"
    ) {
      return NextResponse.json({ error: genericError }, { status: 401 });
    }

    const sessionId = `sess_${crypto.randomBytes(24).toString("hex")}`;
    const token = await encrypt({ type: "student", sessionId, studentId: student.id, sub: student.id });
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await prisma.$transaction(async (tx) => {
      await tx.studentProfileValue.createMany({
        data: profileSeedRows(student.id, student.admission_record),
        skipDuplicates: true,
      });
      await tx.studentAccessSession.create({
        data: {
          student_id: student.id,
          token_hash: tokenHash,
          ip_address: ip,
          user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1_000),
        },
      });
      await tx.auditLog.create({
        data: {
          actor_type: "STUDENT",
          actor_id: student.id,
          action: "STUDENT_LOGIN",
          entity_type: "Student",
          entity_id: student.id,
          request_id: id,
          after_json: { ip },
        },
      });
    });
    await setSession("student_session", { type: "student", sessionId, studentId: student.id }, token);
    return NextResponse.json({
      success: true,
      message: "Đã tìm thấy hồ sơ. Vui lòng kiểm tra và bổ sung thông tin.",
    });
  } catch (error) {
    logServerError("Student access error", error, id);
    return NextResponse.json(publicServerError(id), { status: 500 });
  }
}
