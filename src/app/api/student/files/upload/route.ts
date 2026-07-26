import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canStudentEdit } from "@/domain/student-state";
import { getClientIp, logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { MultipartStreamError, streamSingleMultipartFile } from "@/lib/server/streamingMultipart";
import { MAX_STUDENT_UPLOAD_BYTES, studentUploadMetadataSchema } from "@/lib/validations/fileUpload";
import { enqueueProcessingJob } from "@/services/queue/processingQueue";

export async function POST(request: NextRequest) {
  const id = requestId(request.headers);
  let cleanupIncoming: (() => Promise<void>) | undefined;
  try {
    const session = await getSession("student_session");
    if (!session?.studentId) {
      return NextResponse.json({ error: "Chưa xác thực học sinh.", code: "UNAUTHORIZED" }, { status: 401 });
    }
    const studentId = session.studentId;
    const [studentLimit, ipLimit] = await Promise.all([
      rateLimit(`ratelimit:upload:student:${studentId}`, 12, 10 * 60_000),
      rateLimit(`ratelimit:upload:ip:${getClientIp(request.headers)}`, 30, 10 * 60_000),
    ]);
    if (!studentLimit.success || !ipLimit.success) {
      return NextResponse.json({ error: "Tải tệp quá thường xuyên.", code: "RATE_LIMITED" }, { status: 429 });
    }
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_STUDENT_UPLOAD_BYTES + 512 * 1024) {
      return NextResponse.json({ error: "Dữ liệu tải lên vượt quá giới hạn 5 MB.", code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    }
    const streamed = await streamSingleMultipartFile(request, MAX_STUDENT_UPLOAD_BYTES);
    cleanupIncoming = streamed.cleanup;
    const metadata = studentUploadMetadataSchema.safeParse({ category: streamed.fields.category });
    if (!metadata.success) {
      return NextResponse.json({ error: "Tệp ảnh và loại tệp hợp lệ là bắt buộc.", code: "INVALID_UPLOAD_PAYLOAD" }, { status: 400 });
    }
    if (!/\.(jpe?g)$/i.test(streamed.file.filename)) {
      return NextResponse.json({ error: "Ảnh giấy tờ chỉ nhận JPG/JPEG.", code: "JPEG_REQUIRED" }, { status: 400 });
    }
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { status: true, campaign_id: true },
    });
    if (!student) return NextResponse.json({ error: "Không tìm thấy hồ sơ." }, { status: 404 });
    if (!canStudentEdit(student.status)) {
      return NextResponse.json(
        { error: "Hồ sơ đang ở trạng thái không cho phép thay đổi tệp.", code: "PROFILE_NOT_EDITABLE", status: student.status },
        { status: 409 },
      );
    }
    const dedupeKey = `image:${studentId}:${metadata.data.category}:${streamed.file.checksum}`;
    const existing = await prisma.processingJob.findUnique({ where: { active_dedupe_key: dedupeKey } });
    if (existing) {
      await streamed.cleanup();
      cleanupIncoming = undefined;
      if (existing.status === "PENDING") await enqueueProcessingJob(existing.id, existing.type);
      return NextResponse.json({ success: true, jobId: existing.id, status: existing.status }, { status: 202 });
    }
    const job = await prisma.processingJob.create({
      data: {
        type: "IMAGE_PROCESS",
        campaign_id: student.campaign_id,
        subject_student_id: studentId,
        owner_type: "STUDENT",
        owner_id: studentId,
        input_key: streamed.file.path,
        input_filename: streamed.file.filename,
        input_checksum: streamed.file.checksum,
        payload_json: { category: metadata.data.category, mimeType: streamed.file.mimeType },
        active_dedupe_key: dedupeKey,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
      },
    });
    cleanupIncoming = undefined;
    await enqueueProcessingJob(job.id, job.type);
    return NextResponse.json({ success: true, jobId: job.id, status: job.status }, { status: 202 });
  } catch (error) {
    if (error instanceof MultipartStreamError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "FILE_TOO_LARGE" ? 413 : 400 },
      );
    }
    logServerError("Queue student file upload error", error, id);
    return NextResponse.json(publicServerError(id), { status: 500 });
  } finally {
    if (cleanupIncoming) await cleanupIncoming().catch(() => undefined);
  }
}
