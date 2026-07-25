import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const editSchema = z.object({
  field_code: z.string().min(1),
  proposed_value: z.string(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestIdentifier = requestId(request.headers);
  try {
    const session = await getSession("admin_session");
    if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = editSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { field_code, proposed_value } = parsed.data;

    const student = await prisma.student.findUnique({
      where: { id },
      include: { profile_values: true },
    });

    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    if (["LOCKED"].includes(student.status)) {
      return NextResponse.json({ error: "Cannot edit locked profile" }, { status: 403 });
    }

    const existing = student.profile_values.find(v => v.field_code === field_code);

    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.studentProfileValue.update({
          where: { id: existing.id },
          data: {
            proposed_value,
            change_status: "ACCEPTED",
          },
        });
      } else {
        await tx.studentProfileValue.create({
          data: {
            student_id: student.id,
            field_code,
            source_value: null,
            proposed_value,
            change_status: "ACCEPTED",
          },
        });
      }

      await tx.auditLog.create({
        data: {
          entity_id: student.id,
          entity_type: "STUDENT",
          actor_id: session.userId,
          actor_type: "ADMIN",
          action: "ADMIN_EDIT_PROFILE",
          reason: `Sửa trường ${field_code} thành: ${proposed_value}`,
          before_json: existing?.proposed_value ? { proposed_value: existing.proposed_value } : undefined,
          after_json: { proposed_value },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logServerError("Edit profile error", error, requestIdentifier);
    return NextResponse.json(publicServerError(requestIdentifier), { status: 500 });
  }
}
