import jsQR from "jsqr";
import { FileCategory, Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSession } from "@/lib/auth";
import { parseCccdQr } from "@/lib/cccd/qrParser";
import { logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { readPrivateFile } from "@/lib/server/fileStorage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestIdentifier = requestId(request.headers);
  try {
    const session = await getSession("student_session");
    if (!session?.studentId) return NextResponse.json({ error: "Chưa xác thực học sinh." }, { status: 401 });
    const { id } = await params;
    const file = await prisma.fileRecord.findFirst({
      where: {
        id,
        student_id: session.studentId,
        category: { in: [FileCategory.CCCD_FRONT, FileCategory.CCCD_BACK] },
      },
      select: { id: true, category: true, storage_key: true },
    });
    if (!file) return NextResponse.json({ error: "Không tìm thấy tệp CCCD thuộc hồ sơ này." }, { status: 404 });

    const input = await readPrivateFile(file.storage_key);
    const { data, info } = await sharp(input)
      .rotate()
      .resize({ width: 1600, height: 1200, fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const code = jsQR(new Uint8ClampedArray(data), info.width, info.height, { inversionAttempts: "attemptBoth" });
    const rawPayload = code?.data ?? "";
    const parsed = parseCccdQr(rawPayload);
    const cardSide = file.category === FileCategory.CCCD_FRONT ? "FRONT" : "BACK";

    const qrRecord = await prisma.$transaction(async (tx) => {
      const result = await tx.qrScanResult.create({
        data: {
          file_id: file.id,
          card_side: cardSide,
          raw_payload: rawPayload || null,
          parsed_json: {
            data: parsed as unknown as Prisma.InputJsonValue,
            decoder: { name: "jsQR", version: "1.4.0", execution: "server" },
          },
          success: Boolean(rawPayload),
        },
      });
      await tx.ocrResult.create({
        data: {
          file_id: file.id,
          engine: "server-disabled-manual-review",
          raw_text: null,
          parsed_json: { reason: "OCR language model is not bundled; QR was processed on the server." },
          confidence: null,
        },
      });
      await tx.auditLog.create({
        data: {
          actor_type: "STUDENT",
          actor_id: session.studentId,
          action: "CCCD_SERVER_SCAN_COMPLETED",
          entity_type: "FileRecord",
          entity_id: file.id,
          request_id: requestIdentifier,
          after_json: { cardSide, qrSuccess: Boolean(rawPayload) },
        },
      });
      return result;
    });
    return NextResponse.json({
      success: true,
      cardSide,
      qr: { success: qrRecord.success, rawPayload: qrRecord.raw_payload, parsed },
      ocr: { status: "MANUAL_REVIEW_REQUIRED" },
    });
  } catch (error) {
    logServerError("Persist CCCD server scan error", error, requestIdentifier);
    return NextResponse.json(publicServerError(requestIdentifier), { status: 500 });
  }
}
