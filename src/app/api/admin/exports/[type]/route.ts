import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EXPORTABLE_STATUSES } from "@/lib/server/exportService";
import { enqueueExportJob } from "@/services/queue/exportQueue";

const paramsSchema = z.object({
  type: z.enum(["student-pdf", "school-excel", "bulk-student-pdf-zip", "photo-4x6-zip", "cccd-zip", "scan-report-csv", "scan-report-pdf"]),
});
const bodySchema = z
  .object({ studentId: z.string().cuid().optional() })
  .strict();
const typeMap = {
  "student-pdf": "STUDENT_PDF",
  "school-excel": "SCHOOL_EXCEL",
  "bulk-student-pdf-zip": "BULK_STUDENT_PDF_ZIP",
  "photo-4x6-zip": "PHOTO_ZIP",
  "cccd-zip": "CCCD_ZIP",
  "scan-report-csv": "SCAN_REPORT_CSV",
  "scan-report-pdf": "SCAN_REPORT_PDF",
} as const;

function isActiveDedupeConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ type: string }> },
) {
  const session = await getSession("admin_session");
  if (!session?.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsedParams = paramsSchema.safeParse(await context.params);
  const body = await request.json().catch(() => ({}));
  const parsedBody = bodySchema.safeParse(body);
  if (!parsedParams.success || !parsedBody.success)
    return NextResponse.json(
      { error: "Invalid export request" },
      { status: 400 },
    );
  const type = parsedParams.data.type;
  if ((type === "student-pdf") !== Boolean(parsedBody.data.studentId))
    return NextResponse.json(
      { error: "studentId is required only for student PDF" },
      { status: 400 },
    );
  const dbType = typeMap[type];
  if (
    type === "school-excel" ||
    type === "bulk-student-pdf-zip" ||
    type === "photo-4x6-zip" ||
    type === "cccd-zip" ||
    type === "scan-report-csv" ||
    type === "scan-report-pdf"
  ) {
    const eligibleStudentCount = await prisma.student.count({
      where: { status: { in: [...EXPORTABLE_STATUSES] } },
    });
    if (eligibleStudentCount === 0) {
      const subject =
        type === "school-excel"
          ? "Excel export"
          : type === "bulk-student-pdf-zip"
            ? "student PDF export"
          : type === "photo-4x6-zip"
            ? "photo export"
            : type === "cccd-zip"
              ? "CCCD export"
              : "QR/OCR report export";
      return NextResponse.json(
        {
          error: `No approved, locked, or exported students are available for ${subject}`,
        },
        { status: 422 },
      );
    }
  }
  const dedupeKey = createHash("sha256")
    .update(`${dbType}:${parsedBody.data.studentId ?? "school"}`)
    .digest("hex");
  let exportJob: { id: string; status: string; progress: number };
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.exportJob.findUnique({
        where: { active_dedupe_key: dedupeKey },
      });
      if (existing) return { exportJob: existing };
      const created = await tx.exportJob.create({
        data: {
          type: dbType,
          subject_student_id: parsedBody.data.studentId,
          payload_json: parsedBody.data,
          active_dedupe_key: dedupeKey,
          created_by: session.userId,
        },
      });
      await tx.auditLog.create({
        data: {
          actor_type: "ADMIN",
          actor_id: session.userId,
          action: "EXPORT_REQUESTED",
          entity_type: "ExportJob",
          entity_id: created.id,
          after_json: {
            type: dbType,
            studentId: parsedBody.data.studentId ?? null,
          },
        },
      });
      return { exportJob: created };
    });
    exportJob = result.exportJob;
  } catch (error) {
    if (isActiveDedupeConflict(error)) {
      const existing = await prisma.exportJob.findUnique({
        where: { active_dedupe_key: dedupeKey },
      });
      if (existing) {
        exportJob = existing;
      } else {
        console.error(
          "Create export job dedupe conflict without active job",
          error,
        );
        return NextResponse.json(
          { error: "Unable to create export job" },
          { status: 500 },
        );
      }
    } else {
      console.error("Create export job error", error);
      return NextResponse.json(
        { error: "Unable to create export job" },
        { status: 500 },
      );
    }
  }

  if (exportJob.status === "PENDING") {
    try {
      await enqueueExportJob(exportJob.id, type);
    } catch (error) {
      console.error("Enqueue export job error", error);
      await prisma.auditLog
        .create({
          data: {
            actor_type: "SYSTEM",
            action: "EXPORT_QUEUE_ENQUEUE_FAILED",
            entity_type: "ExportJob",
            entity_id: exportJob.id,
            after_json: {
              type: dbType,
              error:
                error instanceof Error ? error.message : "Unknown queue error",
            },
          },
        })
        .catch((auditError: unknown) =>
          console.error("Audit export queue error", auditError),
        );
      return NextResponse.json(
        {
          error: "Export job is pending queue recovery",
          job: {
            id: exportJob.id,
            status: exportJob.status,
            progress: exportJob.progress,
          },
        },
        { status: 503 },
      );
    }
  }
  return NextResponse.json(
    {
      success: true,
      job: {
        id: exportJob.id,
        status: exportJob.status,
        progress: exportJob.progress,
      },
    },
    { status: 202 },
  );
}
