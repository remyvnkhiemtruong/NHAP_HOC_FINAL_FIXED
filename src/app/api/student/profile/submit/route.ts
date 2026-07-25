import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canStudentSubmit, submittedStatusFor } from "@/domain/student-state";
import { getClientIp, logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requiredFileIssues } from "@/lib/student/fileRequirements";
import { coerceProfileFlags } from "@/lib/student/profilePersistence";
import { studentSchema } from "@/lib/validations/studentSchema";

export async function POST(request: Request) {
  const id = requestId(request.headers);
  try {
    const session = await getSession("student_session");
    if (!session?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: session.studentId },
        include: {
          files: { select: { category: true, status: true, current_version: true } },
          profile_values: true,
          profile_versions: { orderBy: { version_number: "desc" }, take: 1 },
        },
      });
      if (!student) return { kind: "missing" as const };
      if (!canStudentSubmit(student.status)) {
        return { kind: "status" as const, status: student.status };
      }

      const missingFiles = requiredFileIssues(
        student.files.map((file) => ({
          category: file.category,
          status: file.status,
          currentVersion: file.current_version,
        })),
      );
      if (missingFiles.length) return { kind: "files" as const, missingFiles };

      const fields: Record<string, string> = {};
      for (const value of student.profile_values) {
        fields[value.field_code] =
          (["ACCEPTED", "ADMIN_EDITED"].includes(value.change_status) && value.approved_value !== null
            ? value.approved_value
            : value.proposed_value ?? value.source_value) ?? "";
      }
      const validation = studentSchema.safeParse(coerceProfileFlags(fields));
      if (!validation.success) {
        return {
          kind: "validation" as const,
          issues: validation.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        };
      }

      const nextStatus = submittedStatusFor(student.status);
      const versionNumber = (student.profile_versions[0]?.version_number ?? 0) + 1;
      const snapshot = {
        fields,
        files: student.files.map((file) => ({
          category: file.category,
          status: file.status,
          currentVersion: file.current_version,
        })),
        status: nextStatus,
        submittedAt: new Date().toISOString(),
      };
      const version = await tx.studentProfileVersion.create({
        data: {
          student_id: student.id,
          version_number: versionNumber,
          snapshot_json: snapshot,
        },
      });
      await tx.student.update({ where: { id: student.id }, data: { status: nextStatus } });
      await tx.auditLog.create({
        data: {
          actor_type: "STUDENT",
          actor_id: student.id,
          action: nextStatus === "RESUBMITTED" ? "PROFILE_RESUBMITTED" : "PROFILE_SUBMITTED",
          entity_type: "Student",
          entity_id: student.id,
          request_id: id,
          before_json: { status: student.status },
          after_json: { status: nextStatus, versionId: version.id, versionNumber, ip: getClientIp(request.headers) },
        },
      });
      return { kind: "ok" as const, status: nextStatus, versionNumber };
    });

    if (result.kind === "missing") return NextResponse.json({ error: "Student not found" }, { status: 404 });
    if (result.kind === "status") {
      return NextResponse.json(
        { error: "Hồ sơ không thể gửi ở trạng thái hiện tại.", code: "INVALID_PROFILE_STATUS", status: result.status },
        { status: 409 },
      );
    }
    if (result.kind === "files") {
      return NextResponse.json(
        {
          error: "Vui lòng tải đủ hai mặt CCCD và ảnh 4×6 hợp lệ trước khi gửi hồ sơ.",
          code: "REQUIRED_FILES_INVALID",
          missingFiles: result.missingFiles,
        },
        { status: 400 },
      );
    }
    if (result.kind === "validation") {
      return NextResponse.json({ error: "Dữ liệu chưa hợp lệ.", code: "PROFILE_VALIDATION_FAILED", details: result.issues }, { status: 400 });
    }
    return NextResponse.json({ success: true, status: result.status, versionNumber: result.versionNumber });
  } catch (error) {
    logServerError("Submit profile error", error, id);
    return NextResponse.json(publicServerError(id), { status: 500 });
  }
}
