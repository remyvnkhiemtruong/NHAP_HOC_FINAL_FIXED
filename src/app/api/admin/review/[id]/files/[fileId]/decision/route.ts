import { NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_REVIEWABLE_STATUSES } from "@/domain/student-state";
import { getSession } from "@/lib/auth";
import { getClientIp, logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { acquireTransactionLock } from "@/lib/server/advisoryLock";

const bodySchema = z
  .object({ decision: z.enum(["APPROVE", "REJECT"]), reason: z.string().trim().min(10).max(500).optional() })
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
      await acquireTransactionLock(tx, `review:${id}`);
      const student = await tx.student.findUnique({
        where: { id },
        select: {
          status: true,
          profile_versions: {
            orderBy: { version_number: "desc" },
            take: 1,
            select: { id: true, version_number: true },
          },
        },
      });
      if (!student) return { kind: "missing-student" as const };
      if (!ADMIN_REVIEWABLE_STATUSES.has(student.status)) return { kind: "status" as const, status: student.status };
      const file = await tx.fileRecord.findFirst({ where: { id: fileId, student_id: id, is_current: true } });
      if (!file) return { kind: "missing-file" as const };
      const current = await tx.fileRecord.findFirst({
        where: { student_id: id, category: file.category, is_current: true },
        select: { id: true },
      });
      if (!current || current.id !== file.id) return { kind: "stale" as const };
      const status = parsed.data.decision === "APPROVE" ? "ADMIN_APPROVED" : "REUPLOAD_REQUIRED";
      await tx.fileRecord.update({
        where: { id: file.id },
        data: { status, decision_by: session.userId, decision_at: new Date() },
      });
      await tx.reviewDecision.create({
        data: {
          student_id: id,
          file_id: file.id,
          decision: parsed.data.decision,
          value_before: file.status,
          value_after: status,
          reason: parsed.data.reason,
          decided_by: session.userId!,
          profile_version: student.profile_versions[0]?.version_number,
        },
      });
      if (parsed.data.decision === "REJECT") {
        const revision = await tx.revisionRequest.create({
          data: {
            student_id: id,
            profile_version_id: student.profile_versions[0]?.id,
            requested_by: session.userId!,
            general_reason: parsed.data.reason!,
            items: {
              create: {
                target_type: "FILE",
                file_id: file.id,
                reason: parsed.data.reason!,
              },
            },
          },
        });
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
            after_json: {
              status: "NEED_REVISION",
              revisionRequestId: revision.id,
              fileId: file.id,
              ip: getClientIp(request.headers),
            },
            reason: parsed.data.reason,
          },
        });
        return { kind: "ok" as const, status, studentStatus: "NEED_REVISION" as const };
      }
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
      return { kind: "ok" as const, status, studentStatus: student.status };
    });
    if (result.kind === "missing-student" || result.kind === "missing-file") {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ hoặc tệp." }, { status: 404 });
    }
    if (result.kind === "status") return NextResponse.json({ error: "Hồ sơ không ở trạng thái chờ duyệt." }, { status: 409 });
    if (result.kind === "stale") return NextResponse.json({ error: "Chỉ có thể duyệt phiên bản tệp hiện hành." }, { status: 409 });
    return NextResponse.json({
      success: true,
      status: result.status,
      studentStatus: result.studentStatus,
    });
  } catch (error) {
    logServerError("File decision error", error, requestIdentifier);
    return NextResponse.json(publicServerError(requestIdentifier), { status: 500 });
  }
}
