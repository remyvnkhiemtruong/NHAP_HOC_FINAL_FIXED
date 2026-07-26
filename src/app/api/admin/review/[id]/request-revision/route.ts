import { NextResponse } from "next/server";
import { z } from "zod";
import { canTransition } from "@/domain/student-state";
import { getSession } from "@/lib/auth";
import { getClientIp, logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { acquireTransactionLock } from "@/lib/server/advisoryLock";

const bodySchema = z
  .object({
    reason: z.string().trim().min(10).max(1000),
    items: z
      .array(
        z
          .object({
            profileValueId: z.string().cuid().optional(),
            fileId: z.string().cuid().optional(),
            reason: z.string().trim().min(3).max(1000).optional(),
          })
          .strict()
          .refine((item) => Boolean(item.profileValueId) !== Boolean(item.fileId), {
            message: "Mỗi mục phải trỏ tới đúng một trường hoặc tệp.",
          }),
      )
      .min(1)
      .max(200),
    dueAt: z.string().datetime().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const targets = value.items.map((item) =>
      item.profileValueId ? `profile:${item.profileValueId}` : `file:${item.fileId}`,
    );
    if (new Set(targets).size !== targets.length) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Mỗi trường hoặc tệp chỉ được yêu cầu sửa một lần.",
      });
    }
  });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestIdentifier = requestId(request.headers);
  try {
    const session = await getSession("admin_session");
    if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const adminId = session.userId;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Vui lòng nhập lý do yêu cầu bổ sung từ 10 đến 1.000 ký tự." }, { status: 400 });
    const { id } = await params;
    const result = await prisma.$transaction(async (tx) => {
      await acquireTransactionLock(tx, `review:${id}`);
      const student = await tx.student.findUnique({
        where: { id },
        include: {
          profile_values: true,
          files: { where: { is_current: true } },
          profile_versions: { orderBy: { version_number: "desc" }, take: 1 },
        },
      });
      if (!student) return { kind: "missing" as const };
      if (!canTransition(student.status, "NEED_REVISION")) return { kind: "status" as const, status: student.status };
      const profileById = new Map(student.profile_values.map((value) => [value.id, value]));
      const fileById = new Map(student.files.map((file) => [file.id, file]));
      if (
        parsed.data.items.some(
          (item) =>
            (item.profileValueId && !profileById.has(item.profileValueId)) ||
            (item.fileId && !fileById.has(item.fileId)),
        )
      ) {
        return { kind: "foreign-items" as const };
      }
      for (const item of parsed.data.items) {
        if (!item.profileValueId) continue;
        const value = profileById.get(item.profileValueId)!;
        const changed = await tx.studentProfileValue.updateMany({
          where: {
            id: value.id,
            student_id: id,
            change_status: value.change_status,
            updated_at: value.updated_at,
          },
          data: { change_status: "REJECTED", approved_value: value.source_value },
        });
        if (changed.count !== 1) return { kind: "stale" as const };
        await tx.reviewDecision.create({
          data: {
            student_id: id,
            profile_value_id: value.id,
            decision: "REJECT",
            value_before: value.proposed_value,
            value_after: value.source_value,
            reason: item.reason ?? parsed.data.reason,
            decided_by: adminId,
            profile_version: student.profile_versions[0]?.version_number,
          },
        });
      }
      for (const item of parsed.data.items) {
        if (!item.fileId) continue;
        const file = fileById.get(item.fileId)!;
        await tx.fileRecord.update({
          where: { id: file.id },
          data: {
            status: "REUPLOAD_REQUIRED",
            decision_by: adminId,
            decision_at: new Date(),
          },
        });
        await tx.reviewDecision.create({
          data: {
            student_id: id,
            file_id: file.id,
            decision: "REJECT",
            value_before: file.status,
            value_after: "REUPLOAD_REQUIRED",
            reason: item.reason ?? parsed.data.reason,
            decided_by: adminId,
            profile_version: student.profile_versions[0]?.version_number,
          },
        });
      }
      const revision = await tx.revisionRequest.create({
        data: {
          student_id: id,
          profile_version_id: student.profile_versions[0]?.id,
          requested_by: adminId,
          general_reason: parsed.data.reason,
          due_at: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
          items: {
            create: parsed.data.items.map((item) => ({
              target_type: item.profileValueId ? "PROFILE_FIELD" : "FILE",
              profile_value_id: item.profileValueId,
              file_id: item.fileId,
              reason: item.reason ?? parsed.data.reason,
            })),
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
          actor_id: adminId,
          action: "PROFILE_REVISION_REQUESTED",
          entity_type: "Student",
          entity_id: id,
          request_id: requestIdentifier,
          before_json: { status: student.status },
          after_json: { status: "NEED_REVISION", revisionRequestId: revision.id, ip: getClientIp(request.headers) },
          reason: parsed.data.reason,
        },
      });
      return { kind: "ok" as const };
    });
    if (result.kind === "missing") return NextResponse.json({ error: "Không tìm thấy hồ sơ." }, { status: 404 });
    if (result.kind === "status") return NextResponse.json({ error: "Trạng thái hiện tại không cho phép yêu cầu bổ sung." }, { status: 409 });
    if (result.kind === "foreign-items") return NextResponse.json({ error: "Có mục không thuộc hồ sơ." }, { status: 400 });
    if (result.kind === "stale") return NextResponse.json({ error: "Mục đã được xử lý.", code: "REVIEW_ITEM_STALE" }, { status: 409 });
    return NextResponse.json({ success: true, status: "NEED_REVISION" });
  } catch (error) {
    logServerError("Request profile revision error", error, requestIdentifier);
    return NextResponse.json(publicServerError(requestIdentifier), { status: 500 });
  }
}
