import { NextResponse } from "next/server";
import { z } from "zod";
import { canTransition } from "@/domain/student-state";
import { getSession } from "@/lib/auth";
import { getClientIp, logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({ reason: z.string().trim().min(10).max(1000) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestIdentifier = requestId(request.headers);
  try {
    const session = await getSession("admin_session");
    if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Vui lòng nhập lý do yêu cầu bổ sung từ 10 đến 1.000 ký tự." }, { status: 400 });
    const { id } = await params;
    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({ where: { id }, select: { status: true } });
      if (!student) return { kind: "missing" as const };
      if (!canTransition(student.status, "NEED_REVISION")) return { kind: "status" as const, status: student.status };
      await tx.student.update({
        where: { id },
        data: { status: "NEED_REVISION", approved_at: null, locked_at: null },
      });
      await tx.auditLog.create({
        data: {
          actor_type: "ADMIN",
          actor_id: session.userId,
          action: "PROFILE_REVISION_REQUESTED",
          entity_type: "Student",
          entity_id: id,
          request_id: requestIdentifier,
          before_json: { status: student.status },
          after_json: { status: "NEED_REVISION", ip: getClientIp(request.headers) },
          reason: parsed.data.reason,
        },
      });
      return { kind: "ok" as const };
    });
    if (result.kind === "missing") return NextResponse.json({ error: "Không tìm thấy hồ sơ." }, { status: 404 });
    if (result.kind === "status") return NextResponse.json({ error: "Trạng thái hiện tại không cho phép yêu cầu bổ sung." }, { status: 409 });
    return NextResponse.json({ success: true, status: "NEED_REVISION" });
  } catch (error) {
    logServerError("Request profile revision error", error, requestIdentifier);
    return NextResponse.json(publicServerError(requestIdentifier), { status: 500 });
  }
}
