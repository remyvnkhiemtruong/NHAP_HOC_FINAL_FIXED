import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { encryptRandom } from "@/lib/encryption";
import { getClientIp, logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { buildExportContentManifest } from "@/lib/server/exportManifest";
import { effectiveProfileValue } from "@/lib/student/effectiveProfileValue";

const bodySchema = z
  .object({
    artifactJobIds: z.array(z.string().cuid()).min(1).max(20),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine((body) => new Set(body.artifactJobIds).size === body.artifactJobIds.length, {
    message: "Artifact jobs must be unique",
  });

export async function POST(request: Request) {
  const requestIdentifier = requestId(request.headers);
  try {
    const session = await getSession("admin_session");
    if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const adminId = session.userId;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Danh sách artifact không hợp lệ." }, { status: 400 });

    const jobs = await prisma.exportJob.findMany({
      where: { id: { in: parsed.data.artifactJobIds } },
    });
    if (
      jobs.length !== parsed.data.artifactJobIds.length ||
      jobs.some(
        (job) =>
          job.status !== "COMPLETED" ||
          !job.output_checksum ||
          Boolean(job.error_report_key) ||
          !job.cohort_hash ||
          !job.content_manifest ||
          !job.content_manifest_hash,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Artifact phải hoàn tất, không có cảnh báo loại hồ sơ và có checksum, cohort, content manifest; tác vụ cũ cần được xuất lại.",
        },
        { status: 409 },
      );
    }
    const campaignIds = new Set(jobs.map((job) => job.campaign_id));
    const cohortHashes = new Set(jobs.map((job) => job.cohort_hash));
    const contentManifestHashes = new Set(
      jobs.map((job) => job.content_manifest_hash),
    );
    if (
      campaignIds.size !== 1 ||
      cohortHashes.size !== 1 ||
      contentManifestHashes.size !== 1
    ) {
      return NextResponse.json({ error: "Các artifact phải cùng đợt và cùng tập học sinh." }, { status: 409 });
    }
    const firstPayload =
      jobs[0].payload_json && typeof jobs[0].payload_json === "object" && !Array.isArray(jobs[0].payload_json)
        ? (jobs[0].payload_json as { cohortStudentIds?: unknown })
        : {};
    const cohortStudentIds = Array.isArray(firstPayload.cohortStudentIds)
      ? firstPayload.cohortStudentIds.filter((value): value is string => typeof value === "string")
      : [];
    if (!cohortStudentIds.length) {
      return NextResponse.json({ error: "Artifact không có snapshot cohort hợp lệ." }, { status: 409 });
    }

    const students = await prisma.student.findMany({
      where: {
        id: { in: cohortStudentIds },
        campaign_id: jobs[0].campaign_id,
        status: "LOCKED",
      },
      include: {
        admission_record: true,
        profile_values: true,
        profile_versions: {
          orderBy: { version_number: "desc" },
          take: 1,
          select: { version_number: true },
        },
        files: {
          where: { is_current: true },
          select: {
            id: true,
            category: true,
            checksum: true,
            current_version: true,
            status: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });
    if (students.length !== cohortStudentIds.length) {
      return NextResponse.json(
        { error: "Cohort đã thay đổi hoặc có hồ sơ không còn LOCKED.", code: "EXPORT_COHORT_STALE" },
        { status: 409 },
      );
    }
    const currentContent = buildExportContentManifest(
      jobs[0].campaign_id,
      students,
    );
    if (currentContent.hash !== jobs[0].content_manifest_hash) {
      return NextResponse.json(
        {
          error:
            "Dữ liệu hồ sơ hoặc tệp đã thay đổi sau khi tạo artifact. Vui lòng xuất lại.",
          code: "EXPORT_CONTENT_STALE",
        },
        { status: 409 },
      );
    }

    const snapshots = students.map((student) => {
      const plaintext = JSON.stringify({
        studentId: student.id,
        campaignId: student.campaign_id,
        fields: Object.fromEntries(
          student.profile_values.map((value) => [value.field_code, effectiveProfileValue(value)]),
        ),
        files: student.files,
      });
      const checksum = crypto.createHash("sha256").update(plaintext).digest("hex");
      return {
        student_id: student.id,
        snapshot_json: encryptRandom(plaintext),
        snapshot_checksum: checksum,
      };
    });
    const snapshotChecksum = crypto
      .createHash("sha256")
      .update(snapshots.map((snapshot) => snapshot.snapshot_checksum).join("\n"))
      .digest("hex");

    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.exportBatch.create({
        data: {
          campaign_id: jobs[0].campaign_id,
          cohort_hash: jobs[0].cohort_hash!,
          snapshot_checksum: snapshotChecksum,
          created_by: adminId,
          note: parsed.data.note,
        },
      });
      await tx.exportBatchArtifact.createMany({
        data: jobs.map((job) => ({
          export_batch_id: created.id,
          export_job_id: job.id,
          output_checksum: job.output_checksum!,
        })),
      });
      await tx.exportBatchStudent.createMany({
        data: snapshots.map((snapshot) => ({ ...snapshot, export_batch_id: created.id })),
      });
      const updated = await tx.student.updateMany({
        where: { id: { in: cohortStudentIds }, campaign_id: jobs[0].campaign_id, status: "LOCKED" },
        data: { status: "EXPORTED" },
      });
      if (updated.count !== cohortStudentIds.length) throw new Error("EXPORT_COHORT_STALE");
      await tx.auditLog.create({
        data: {
          actor_type: "ADMIN",
          actor_id: adminId,
          action: "OFFICIAL_EXPORT_CREATED",
          entity_type: "ExportBatch",
          entity_id: created.id,
          request_id: requestIdentifier,
          after_json: {
            campaignId: jobs[0].campaign_id,
            cohortHash: jobs[0].cohort_hash,
            snapshotChecksum,
            artifactJobIds: parsed.data.artifactJobIds,
            studentCount: students.length,
            ip: getClientIp(request.headers),
          },
        },
      });
      return created;
    });

    return NextResponse.json({ success: true, batch: { id: batch.id, studentCount: students.length } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "EXPORT_COHORT_STALE") {
      return NextResponse.json({ error: "Cohort đã thay đổi.", code: "EXPORT_COHORT_STALE" }, { status: 409 });
    }
    logServerError("Create official export batch error", error, requestIdentifier);
    return NextResponse.json(publicServerError(requestIdentifier), { status: 500 });
  }
}
