import { NextResponse } from "next/server";
import { z } from "zod";
import { canTransition } from "@/domain/student-state";
import { getSession } from "@/lib/auth";
import { getClientIp, logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { acquireTransactionLock } from "@/lib/server/advisoryLock";

const bodySchema = z.object({ lock: z.boolean() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestIdentifier = requestId(request.headers);
  try {
    const session = await getSession("admin_session");
    if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Dữ liệu khóa hồ sơ không hợp lệ." }, { status: 400 });
    const { id } = await params;
    const result = await prisma.$transaction(async (tx) => {
      await acquireTransactionLock(tx, `review:${id}`);
      const student = await tx.student.findUnique({ where: { id }, select: { id: true, status: true } });
      if (!student) return { kind: "missing" as const };
      const nextStatus = parsed.data.lock ? "LOCKED" : "APPROVED";
      if (!canTransition(student.status, nextStatus)) {
        return { kind: "status" as const, status: student.status, nextStatus };
      }
      await tx.student.update({
        where: { id },
        data: { status: nextStatus, locked_at: parsed.data.lock ? new Date() : null },
      });
      await tx.auditLog.create({
        data: {
          actor_type: "ADMIN",
          actor_id: session.userId,
          action: parsed.data.lock ? "LOCK_PROFILE" : "UNLOCK_PROFILE",
          entity_type: "Student",
          entity_id: id,
          request_id: requestIdentifier,
          before_json: { status: student.status },
          after_json: { status: nextStatus, ip: getClientIp(request.headers) },
        },
      });
      return { kind: "ok" as const, status: nextStatus };
    });
    if (result.kind === "missing") return NextResponse.json({ error: "Học sinh không tồn tại." }, { status: 404 });
    if (result.kind === "status") {
      return NextResponse.json({ error: `Không thể chuyển từ ${result.status} sang ${result.nextStatus}.` }, { status: 409 });
    }
    return NextResponse.json({ success: true, status: result.status });
  } catch (error) {
    logServerError("Lock/unlock error", error, requestIdentifier);
    return NextResponse.json(publicServerError(requestIdentifier), { status: 500 });
  }
}
