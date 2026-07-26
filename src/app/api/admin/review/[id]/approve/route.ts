import { NextResponse } from "next/server";
import { z } from "zod";
import { ChangeStatus, Prisma } from "@/generated/prisma/client";
import { ADMIN_REVIEWABLE_STATUSES } from "@/domain/student-state";
import { getSession } from "@/lib/auth";
import { getClientIp, logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { acquireTransactionLock } from "@/lib/server/advisoryLock";
import { profileFieldValueSchema } from "@/lib/validations/profileFieldSchema";

const reviewItemSchema = z
  .object({
    id: z.string().cuid(),
    expectedUpdatedAt: z.string().datetime(),
    action: z.enum(["ACCEPT", "REJECT", "EDIT"]),
    new_value: z.string().max(2000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === "EDIT" && value.new_value === undefined) {
      context.addIssue({ code: "custom", path: ["new_value"], message: "Giá trị chỉnh sửa là bắt buộc." });
    }
  });

class ReviewStaleError extends Error {
  constructor() {
    super("REVIEW_ITEM_STALE");
  }
}

const bodySchema = z
  .object({
    items: z.array(reviewItemSchema).max(200).default([]),
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
    const adminId = session.userId;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Dữ liệu quyết định không hợp lệ.", details: parsed.error.flatten() }, { status: 400 });
    }
    const { id } = await params;
    const result = await prisma.$transaction(async (transaction) => {
      await acquireTransactionLock(transaction, `review:${id}`);
      const student = await transaction.student.findUnique({
        where: { id },
        include: {
          profile_values: true,
        },
      });
      if (!student) return { kind: "missing" as const };
      if (!ADMIN_REVIEWABLE_STATUSES.has(student.status)) {
        return { kind: "status" as const, status: student.status };
      }

      const valueById = new Map(student.profile_values.map((value) => [value.id, value]));
      const unknownIds = parsed.data.items.filter((item) => !valueById.has(item.id)).map((item) => item.id);
      if (unknownIds.length) return { kind: "foreign-items" as const };
      const staleItems = parsed.data.items.filter((item) => {
        const value = valueById.get(item.id);
        return (
          !value ||
          (item.action !== "EDIT" && value.change_status !== "PROPOSED") ||
          value.updated_at.toISOString() !== item.expectedUpdatedAt
        );
      });
      if (staleItems.length) throw new ReviewStaleError();
      for (const item of parsed.data.items) {
        if (item.action !== "EDIT") continue;
        const value = valueById.get(item.id)!;
        const fieldValidation = profileFieldValueSchema(value.field_code).safeParse(item.new_value ?? "");
        if (!fieldValidation.success) {
          return {
            kind: "validation" as const,
            error: fieldValidation.error.issues[0]?.message ?? "Giá trị chỉnh sửa không hợp lệ.",
          };
        }
      }

      let cccd = student.current_cccd;
      let dob = student.current_dob;
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
        const updated = await transaction.studentProfileValue.updateMany({
          where: {
            id: value.id,
            student_id: id,
            change_status:
              item.action === "EDIT" ? value.change_status : "PROPOSED",
            updated_at: value.updated_at,
          },
          data: { change_status: changeStatus, approved_value: approvedValue },
        });
        if (updated.count !== 1) throw new ReviewStaleError();
        await transaction.reviewDecision.create({
          data: {
            student_id: id,
            profile_value_id: value.id,
            decision: item.action,
            value_before: value.proposed_value,
            value_after: approvedValue,
            decided_by: adminId,
          },
        });
        if (approvedValue) {
          if (value.field_code === "BF") cccd = approvedValue;
          if (value.field_code === "F") dob = approvedValue;
        }
      }

      await transaction.student.update({
        where: { id },
        data: {
          current_cccd: cccd,
          current_dob: dob,
        },
      });
      await transaction.auditLog.create({
        data: {
          actor_type: "ADMIN",
          actor_id: adminId,
          action: "PROFILE_REVIEWED",
          entity_type: "Student",
          entity_id: id,
          request_id: requestIdentifier,
          before_json: { status: student.status },
          after_json: {
            status: student.status,
            reviewedFieldCodes: parsed.data.items.map((item) => valueById.get(item.id)?.field_code).filter((code): code is string => Boolean(code)),
            ip: getClientIp(request.headers),
          },
        },
      });
      return { kind: "ok" as const, status: student.status };
    });

    if (result.kind === "missing") return NextResponse.json({ error: "Student not found" }, { status: 404 });
    if (result.kind === "status") {
      return NextResponse.json({ error: "Hồ sơ không ở trạng thái chờ duyệt.", status: result.status }, { status: 409 });
    }
    if (result.kind === "foreign-items") {
      return NextResponse.json({ error: "Có trường dữ liệu không thuộc hồ sơ đang duyệt." }, { status: 400 });
    }
    if (result.kind === "validation") {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, status: result.status });
  } catch (error) {
    if (error instanceof ReviewStaleError) {
      return NextResponse.json(
        { error: "Trường dữ liệu đã được xử lý hoặc thay đổi.", code: "REVIEW_ITEM_STALE" },
        { status: 409 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Số CCCD đã được sử dụng bởi hồ sơ khác." }, { status: 409 });
    }
    logServerError("Approve review error", error, requestIdentifier);
    return NextResponse.json(publicServerError(requestIdentifier), { status: 500 });
  }
}
