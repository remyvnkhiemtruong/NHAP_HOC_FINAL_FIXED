import { FileCategory } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClientIp, logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { enqueueProcessingJob } from "@/services/queue/processingQueue";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestIdentifier = requestId(request.headers);
  try {
    const session = await getSession("student_session");
    if (!session?.studentId) return NextResponse.json({ error: "Chưa xác thực học sinh." }, { status: 401 });
    const [studentLimit, ipLimit] = await Promise.all([
      rateLimit(`ratelimit:scan:student:${session.studentId}`, 10, 10 * 60_000),
      rateLimit(`ratelimit:scan:ip:${getClientIp(request.headers)}`, 30, 10 * 60_000),
    ]);
    if (!studentLimit.success || !ipLimit.success) {
      return NextResponse.json({ error: "Quét ảnh quá thường xuyên.", code: "RATE_LIMITED" }, { status: 429 });
    }
    const { id } = await params;
    const file = await prisma.fileRecord.findFirst({
      where: {
        id,
        student_id: session.studentId,
        category: { in: [FileCategory.CCCD_FRONT, FileCategory.CCCD_BACK] },
        is_current: true,
      },
      select: { id: true, checksum: true, current_version: true, student: { select: { campaign_id: true } } },
    });
    if (!file) return NextResponse.json({ error: "Không tìm thấy tệp CCCD thuộc hồ sơ này." }, { status: 404 });
    const dedupeKey = `qr:${file.id}:${file.current_version}:${file.checksum}:jsqr-1.4.0`;
    const existing = await prisma.processingJob.findUnique({ where: { active_dedupe_key: dedupeKey } });
    if (existing) {
      if (existing.status === "PENDING") await enqueueProcessingJob(existing.id, existing.type);
      return NextResponse.json({ success: true, jobId: existing.id, status: existing.status }, { status: 202 });
    }
    const job = await prisma.processingJob.create({
      data: {
        type: "QR_SCAN",
        campaign_id: file.student.campaign_id,
        subject_student_id: session.studentId,
        subject_file_id: file.id,
        owner_type: "STUDENT",
        owner_id: session.studentId,
        active_dedupe_key: dedupeKey,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
      },
    });
    await enqueueProcessingJob(job.id, job.type);
    return NextResponse.json({ success: true, jobId: job.id, status: job.status }, { status: 202 });
  } catch (error) {
    logServerError("Queue CCCD scan error", error, requestIdentifier);
    return NextResponse.json(publicServerError(requestIdentifier), { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession("student_session");
  if (!session?.studentId) return NextResponse.json({ error: "Chưa xác thực học sinh." }, { status: 401 });
  const { id } = await params;
  const file = await prisma.fileRecord.findFirst({
    where: { id, student_id: session.studentId, is_current: true },
    include: {
      qr_scan_results: { orderBy: { created_at: "desc" }, take: 1 },
      processing_jobs: { where: { type: "QR_SCAN" }, orderBy: { created_at: "desc" }, take: 1 },
    },
  });
  if (!file) return NextResponse.json({ error: "Không tìm thấy tệp." }, { status: 404 });
  return NextResponse.json({
    success: true,
    job: file.processing_jobs[0]
      ? {
          id: file.processing_jobs[0].id,
          status: file.processing_jobs[0].status,
          progress: file.processing_jobs[0].progress,
          error: file.processing_jobs[0].error_message,
        }
      : null,
    qr: file.qr_scan_results[0]
      ? { success: file.qr_scan_results[0].success, parsed: file.qr_scan_results[0].parsed_json }
      : null,
  });
}
