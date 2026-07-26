import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { activeCampaign } from "@/lib/campaign";
import { getClientIp, logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { MultipartStreamError, streamSingleMultipartFile } from "@/lib/server/streamingMultipart";
import { enqueueProcessingJob } from "@/services/queue/processingQueue";

const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function POST(request: Request) {
  const requestIdentifier = requestId(request.headers);
  let cleanup: (() => Promise<void>) | undefined;
  try {
    const session = await getSession("admin_session");
    if (!session?.userId || !session.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_IMPORT_BYTES + 512 * 1024) {
      return NextResponse.json({ error: "File nhập vượt quá giới hạn 20 MB." }, { status: 413 });
    }
    const streamed = await streamSingleMultipartFile(request, MAX_IMPORT_BYTES);
    cleanup = streamed.cleanup;
    if (!streamed.file.filename.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Cần tải lên một file Excel .xlsx hợp lệ." }, { status: 400 });
    }
    if (
      streamed.file.mimeType &&
      streamed.file.mimeType !== XLSX_MIME &&
      streamed.file.mimeType !== "application/octet-stream"
    ) {
      return NextResponse.json({ error: "Kiểu nội dung của file không phải XLSX." }, { status: 400 });
    }
    const campaignId = streamed.fields.campaignId || (await activeCampaign()).id;
    const campaign = await prisma.admissionCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.status === "CLOSED") {
      return NextResponse.json({ error: "Đợt tuyển sinh không tồn tại hoặc đã đóng." }, { status: 409 });
    }
    const dedupeKey = `import:${campaignId}:${streamed.file.checksum}`;
    const existing = await prisma.processingJob.findUnique({ where: { active_dedupe_key: dedupeKey } });
    if (existing) {
      await cleanup();
      cleanup = undefined;
      if (existing.status === "PENDING") await enqueueProcessingJob(existing.id, existing.type);
      return NextResponse.json({ success: true, reusedJob: true, jobId: existing.id }, { status: 202 });
    }
    const job = await prisma.processingJob.create({
      data: {
        type: "IMPORT_XLSX",
        campaign_id: campaignId,
        owner_type: "ADMIN",
        owner_id: session.userId,
        input_key: streamed.file.path,
        input_filename: streamed.file.filename,
        input_checksum: streamed.file.checksum,
        payload_json: { adminUsername: session.username },
        active_dedupe_key: dedupeKey,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
      },
    });
    cleanup = undefined;
    await prisma.auditLog.create({
      data: {
        actor_type: "ADMIN",
        actor_id: session.userId,
        action: "ADMISSION_IMPORT_QUEUED",
        entity_type: "ProcessingJob",
        entity_id: job.id,
        request_id: requestIdentifier,
        after_json: {
          campaignId,
          checksum: streamed.file.checksum,
          size: streamed.file.size,
          ip: getClientIp(request.headers),
        },
      },
    });
    try {
      await enqueueProcessingJob(job.id, job.type);
    } catch (error) {
      logServerError("Enqueue import job error", error, requestIdentifier);
      return NextResponse.json(
        { error: "Tác vụ đang chờ Redis phục hồi.", jobId: job.id },
        { status: 503 },
      );
    }
    return NextResponse.json({ success: true, jobId: job.id, status: job.status }, { status: 202 });
  } catch (error) {
    if (error instanceof MultipartStreamError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "FILE_TOO_LARGE" ? 413 : 400 },
      );
    }
    logServerError("Queue import error", error, requestIdentifier);
    return NextResponse.json(publicServerError(requestIdentifier), { status: 500 });
  } finally {
    if (cleanup) await cleanup().catch(() => undefined);
  }
}
