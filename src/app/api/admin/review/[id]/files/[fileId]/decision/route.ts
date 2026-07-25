import { NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_REVIEWABLE_STATUSES } from "@/domain/student-state";
import { getSession } from "@/lib/auth";
import { getClientIp, logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const bodySchema = z
  .object({ decision: z.enum(["APPROVE", "REJECT"]), reason: z.string().trim().max(500).optional() })
  .strict()
  .superRefine((value, context) => {
    if (value.decision === "REJECT" && !value.reason) {
      context.addIssue({ code: "custom", path: ["reason"], message: "Lý do từ chối là bắt buộc." });
    }
  });

export async function POST(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const requestIdentifier = requestId(request.headers);
  try {
    const session = await getSession("admin_session");
    if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Dữ liệu duyệt tệp không hợp lệ." }, { status: 400 });
    const { id, fileId } = await params;
    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({ where: { id }, select: { status: true } });
      if (!student) return { kind: "missing-student" as const };
      if (!ADMIN_REVIEWABLE_STATUSES.has(student.status)) return { kind: "status" as const, status: student.status };
      const file = await tx.fileRecord.findFirst({ where: { id: fileId, student_id: id } });
      if (!file) return { kind: "missing-file" as const };
      const current = await tx.fileRecord.findFirst({
        where: { student_id: id, category: file.category },
        orderBy: { current_version: "desc" },
        select: { id: true },
      });
      if (!current || current.id !== file.id) return { kind: "stale" as const };
      const status = parsed.data.decision === "APPROVE" ? "ADMIN_APPROVED" : "ADMIN_REJECTED";
      await tx.fileRecord.update({
        where: { id: file.id },
        data: { status, decision_by: session.userId, decision_at: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actor_type: "ADMIN",
          actor_id: session.userId,
          action: parsed.data.decision === "APPROVE" ? "FILE_APPROVED" : "FILE_REJECTED",
          entity_type: "FileRecord",
          entity_id: file.id,
          request_id: requestIdentifier,
          before_json: { status: file.status },
          after_json: { studentId: id, category: file.category, status, ip: getClientIp(request.headers) },
          reason: parsed.data.reason,
        },
      });
      return { kind: "ok" as const, status };
    });
    if (result.kind === "missing-student" || result.kind === "missing-file") {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ hoặc tệp." }, { status: 404 });
    }
    if (result.kind === "status") return NextResponse.json({ error: "Hồ sơ không ở trạng thái chờ duyệt." }, { status: 409 });
    if (result.kind === "stale") return NextResponse.json({ error: "Chỉ có thể duyệt phiên bản tệp hiện hành." }, { status: 409 });
    return NextResponse.json({ success: true, status: result.status });
  } catch (error) {
    logServerError("File decision error", error, requestIdentifier);
    return NextResponse.json(publicServerError(requestIdentifier), { status: 500 });
  }
}
