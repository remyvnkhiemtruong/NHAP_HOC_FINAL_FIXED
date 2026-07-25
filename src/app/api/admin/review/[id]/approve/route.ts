import { NextResponse } from "next/server";
import { z } from "zod";
import { ChangeStatus, Prisma } from "@/generated/prisma/client";
import { ADMIN_REVIEWABLE_STATUSES } from "@/domain/student-state";
import { getSession } from "@/lib/auth";
import { getClientIp, logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requiredFileIssues } from "@/lib/student/fileRequirements";

const reviewItemSchema = z
  .object({
    id: z.string().cuid(),
    action: z.enum(["ACCEPT", "REJECT", "EDIT"]),
    new_value: z.string().max(2000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === "EDIT" && value.new_value === undefined) {
      context.addIssue({ code: "custom", path: ["new_value"], message: "Giá trị chỉnh sửa là bắt buộc." });
    }
  });

const bodySchema = z
  .object({
    items: z.array(reviewItemSchema).max(200).default([]),
    completeReview: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", path: ["items"], message: "Mỗi trường chỉ được quyết định một lần." });
    }
  });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestIdentifier = requestId(request.headers);
  try {
    const session = await getSession("admin_session");
    if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Dữ liệu quyết định không hợp lệ.", details: parsed.error.flatten() }, { status: 400 });
    }
    const { id } = await params;
    const result = await prisma.$transaction(async (transaction) => {
      const student = await transaction.student.findUnique({
        where: { id },
        include: {
          profile_values: true,
          files: { select: { category: true, status: true, current_version: true } },
          profile_versions: { orderBy: { version_number: "desc" }, take: 1 },
        },
      });
      if (!student) return { kind: "missing" as const };
      if (!ADMIN_REVIEWABLE_STATUSES.has(student.status)) {
        return { kind: "status" as const, status: student.status };
      }

      const valueById = new Map(student.profile_values.map((value) => [value.id, value]));
      const unknownIds = parsed.data.items.filter((item) => !valueById.has(item.id)).map((item) => item.id);
      if (unknownIds.length) return { kind: "foreign-items" as const };

      let cccd = student.current_cccd;
      let dob = student.current_dob;
      const decisions = new Map<string, ChangeStatus>();
      for (const item of parsed.data.items) {
        const value = valueById.get(item.id)!;
        const approvedValue =
          item.action === "ACCEPT"
            ? value.proposed_value
            : item.action === "EDIT"
              ? item.new_value?.trim() ?? ""
              : value.source_value;
        const changeStatus =
          item.action === "ACCEPT"
            ? ChangeStatus.ACCEPTED
            : item.action === "REJECT"
              ? ChangeStatus.REJECTED
              : ChangeStatus.ADMIN_EDITED;
        await transaction.studentProfileValue.update({
          where: { id: value.id },
          data: { change_status: changeStatus, approved_value: approvedValue },
        });
        decisions.set(value.id, changeStatus);
        if (approvedValue) {
          if (value.field_code === "BF") cccd = approvedValue;
          if (value.field_code === "F") dob = approvedValue;
        }
      }

      if (parsed.data.completeReview) {
        const unresolved = student.profile_values.filter(
          (value) => value.change_status === "PROPOSED" && !decisions.has(value.id),
        );
        if (unresolved.length) {
          return { kind: "unresolved" as const, fields: unresolved.map((value) => value.field_code) };
        }
        const fileIssues = requiredFileIssues(
          student.files.map((file) => ({
            category: file.category,
            status: file.status,
            currentVersion: file.current_version,
          })),
        );
        if (fileIssues.length) return { kind: "files" as const, fileIssues };
      }

      await transaction.student.update({
        where: { id },
        data: {
          current_cccd: cccd,
          current_dob: dob,
          ...(parsed.data.completeReview ? { status: "APPROVED", approved_at: new Date(), locked_at: null } : {}),
        },
      });
      if (parsed.data.completeReview && student.profile_versions[0]) {
        await transaction.studentProfileVersion.update({
          where: { id: student.profile_versions[0].id },
          data: { approved_at: new Date() },
        });
      }
      await transaction.auditLog.create({
        data: {
          actor_type: "ADMIN",
          actor_id: session.userId,
          action: parsed.data.completeReview ? "PROFILE_APPROVED" : "PROFILE_REVIEWED",
          entity_type: "Student",
          entity_id: id,
          request_id: requestIdentifier,
          before_json: { status: student.status },
          after_json: {
            status: parsed.data.completeReview ? "APPROVED" : student.status,
            completeReview: parsed.data.completeReview,
            reviewedFieldCodes: parsed.data.items.map((item) => valueById.get(item.id)?.field_code).filter((code): code is string => Boolean(code)),
            ip: getClientIp(request.headers),
          },
        },
      });
      return { kind: "ok" as const, status: parsed.data.completeReview ? "APPROVED" : student.status };
    });

    if (result.kind === "missing") return NextResponse.json({ error: "Student not found" }, { status: 404 });
    if (result.kind === "status") {
      return NextResponse.json({ error: "Hồ sơ không ở trạng thái chờ duyệt.", status: result.status }, { status: 409 });
    }
    if (result.kind === "foreign-items") {
      return NextResponse.json({ error: "Có trường dữ liệu không thuộc hồ sơ đang duyệt." }, { status: 400 });
    }
    if (result.kind === "unresolved") {
      return NextResponse.json({ error: "Còn trường thay đổi chưa được quyết định.", fields: result.fields }, { status: 409 });
    }
    if (result.kind === "files") {
      return NextResponse.json({ error: "Các tệp bắt buộc chưa được duyệt hợp lệ.", files: result.fileIssues }, { status: 409 });
    }
    return NextResponse.json({ success: true, status: result.status });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Số CCCD đã được sử dụng bởi hồ sơ khác." }, { status: 409 });
    }
    logServerError("Approve review error", error, requestIdentifier);
    return NextResponse.json(publicServerError(requestIdentifier), { status: 500 });
  }
}
