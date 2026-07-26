import { NextResponse } from "next/server";
import { ADMIN_REVIEWABLE_STATUSES } from "@/domain/student-state";
import { getSession } from "@/lib/auth";
import {
  getClientIp,
  logServerError,
  publicServerError,
  requestId,
} from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { acquireTransactionLock } from "@/lib/server/advisoryLock";
import { requiredFileIssues } from "@/lib/student/fileRequirements";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestIdentifier = requestId(request.headers);
  try {
    const session = await getSession("admin_session");
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const result = await prisma.$transaction(async (tx) => {
      await acquireTransactionLock(tx, `review:${id}`);
      const student = await tx.student.findUnique({
        where: { id },
        include: {
          profile_values: {
            where: { change_status: "PROPOSED" },
            select: { field_code: true },
          },
          files: {
            where: { is_current: true },
            select: {
              category: true,
              status: true,
              current_version: true,
            },
          },
          profile_versions: {
            orderBy: { version_number: "desc" },
            take: 1,
          },
        },
      });
      if (!student) return { kind: "missing" as const };
      if (!ADMIN_REVIEWABLE_STATUSES.has(student.status)) {
        return { kind: "status" as const, status: student.status };
      }
      if (student.profile_values.length) {
        return {
          kind: "unresolved" as const,
          fields: student.profile_values.map((value) => value.field_code),
        };
      }
      const fileIssues = requiredFileIssues(
        student.files.map((file) => ({
          category: file.category,
          status: file.status,
          currentVersion: file.current_version,
        })),
      );
      if (fileIssues.length) {
        return { kind: "files" as const, fileIssues };
      }
      await tx.student.update({
        where: { id },
        data: {
          status: "APPROVED",
          approved_at: new Date(),
          locked_at: null,
        },
      });
      if (student.profile_versions[0]) {
        await tx.studentProfileVersion.update({
          where: { id: student.profile_versions[0].id },
          data: { approved_at: new Date() },
        });
      }
      await tx.auditLog.create({
        data: {
          actor_type: "ADMIN",
          actor_id: session.userId,
          action: "PROFILE_APPROVED",
          entity_type: "Student",
          entity_id: id,
          request_id: requestIdentifier,
          before_json: { status: student.status },
          after_json: {
            status: "APPROVED",
            ip: getClientIp(request.headers),
          },
        },
      });
      return { kind: "ok" as const };
    });

    if (result.kind === "missing") {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    if (result.kind === "status") {
      return NextResponse.json(
        { error: "Hồ sơ không ở trạng thái chờ duyệt.", status: result.status },
        { status: 409 },
      );
    }
    if (result.kind === "unresolved") {
      return NextResponse.json(
        {
          error: "Còn trường thay đổi chưa được quyết định.",
          fields: result.fields,
        },
        { status: 409 },
      );
    }
    if (result.kind === "files") {
      return NextResponse.json(
        {
          error: "Các tệp bắt buộc chưa được duyệt hợp lệ.",
          files: result.fileIssues,
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true, status: "APPROVED" });
  } catch (error) {
    logServerError("Complete review error", error, requestIdentifier);
    return NextResponse.json(publicServerError(requestIdentifier), {
      status: 500,
    });
  }
}
