import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const paramsSchema = z.object({ id: z.string().cuid() });

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession("student_session");
  if (!session?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  const job = await prisma.processingJob.findFirst({
    where: { id: params.data.id, owner_type: "STUDENT", owner_id: session.studentId },
  });
  if (!job) return NextResponse.json({ error: "Không tìm thấy tác vụ." }, { status: 404 });
  return NextResponse.json({
    success: true,
    job: {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      result: job.result_json,
      error: job.status === "FAILED" ? { code: job.error_code, message: job.error_message } : null,
    },
  });
}
