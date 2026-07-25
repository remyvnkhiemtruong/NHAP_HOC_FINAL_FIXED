import { FileCategory } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canStudentEdit } from "@/domain/student-state";
import { getClientIp, logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  calculateChecksum,
  deletePrivateFile,
  savePrivateFile,
  validateMagicBytes,
} from "@/lib/server/fileStorage";
import { inspectAndNormalizeImage, inspectPhoto4x6 } from "@/lib/server/imageInspection";
import {
  MAX_STUDENT_UPLOAD_BYTES,
  studentUploadMetadataSchema,
} from "@/lib/validations/fileUpload";

function isUniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function POST(request: NextRequest) {
  const id = requestId(request.headers);
  let storageKey: string | null = null;
  try {
    const session = await getSession("student_session");
    if (!session?.studentId) {
      return NextResponse.json({ error: "Chưa xác thực học sinh.", code: "UNAUTHORIZED" }, { status: 401 });
    }
    const studentId = session.studentId;
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_STUDENT_UPLOAD_BYTES + 512 * 1024) {
      return NextResponse.json({ error: "Dữ liệu tải lên vượt quá giới hạn 5 MB.", code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    }

    const formData = await request.formData();
    const fileEntry = formData.get("file");
    const metadata = studentUploadMetadataSchema.safeParse({ category: formData.get("category") });
    if (!(fileEntry instanceof File) || !metadata.success) {
      return NextResponse.json({ error: "Tệp ảnh và loại tệp hợp lệ là bắt buộc.", code: "INVALID_UPLOAD_PAYLOAD" }, { status: 400 });
    }
    if (fileEntry.size === 0 || fileEntry.size > MAX_STUDENT_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Ảnh phải có dung lượng từ 1 byte đến 5 MB.", code: "INVALID_FILE_SIZE" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { status: true } });
    if (!student) return NextResponse.json({ error: "Không tìm thấy hồ sơ." }, { status: 404 });
    if (!canStudentEdit(student.status)) {
      return NextResponse.json(
        { error: "Hồ sơ đang ở trạng thái không cho phép thay đổi tệp.", code: "PROFILE_NOT_EDITABLE", status: student.status },
        { status: 409 },
      );
    }

    const input = Buffer.from(await fileEntry.arrayBuffer());
    const magicType = validateMagicBytes(input);
    if (!magicType) {
      return NextResponse.json({ error: "Tệp không có cấu trúc ảnh JPEG/PNG hợp lệ.", code: "UNSUPPORTED_FILE_TYPE" }, { status: 400 });
    }
    const category = metadata.data.category;
    if (["CCCD_FRONT", "CCCD_BACK", "PHOTO_4X6"].includes(category) && magicType !== "JPEG") {
      return NextResponse.json({ error: "Loại ảnh này chỉ nhận JPG/JPEG.", code: "JPEG_REQUIRED" }, { status: 400 });
    }

    const photoInspection = category === "PHOTO_4X6" ? await inspectPhoto4x6(input) : null;
    const inspection = photoInspection ?? (await inspectAndNormalizeImage(input, ["jpeg"]));
    const normalized = inspection.normalized;
    if (normalized.length > MAX_STUDENT_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Ảnh sau chuẩn hóa vượt quá giới hạn 5 MB.", code: "NORMALIZED_FILE_TOO_LARGE" }, { status: 400 });
    }
    storageKey = await savePrivateFile(studentId, normalized, "jpg");

    let fileRecord: Awaited<ReturnType<typeof prisma.fileRecord.create>> | null = null;
    for (let attempt = 0; attempt < 3 && !fileRecord; attempt += 1) {
      try {
        fileRecord = await prisma.$transaction(async (tx) => {
          const latest = await tx.fileRecord.findFirst({
            where: { student_id: studentId, category: category as FileCategory },
            orderBy: { current_version: "desc" },
            select: { current_version: true },
          });
          const created = await tx.fileRecord.create({
            data: {
              student_id: studentId,
              category: category as FileCategory,
              storage_key: storageKey!,
              original_name: (fileEntry.name || "upload.jpg").slice(0, 255),
              mime: "image/jpeg",
              size: normalized.length,
              checksum: calculateChecksum(normalized),
              width: inspection.width,
              height: inspection.height,
              current_version: (latest?.current_version ?? 0) + 1,
              status: photoInspection?.status ?? "AUTO_VALID",
              created_by: studentId,
              quarantine: false,
            },
          });
          if (photoInspection) {
            await tx.photoScanResult.create({
              data: {
                file_id: created.id,
                valid: photoInspection.status === "AUTO_VALID",
                warning_codes: [...photoInspection.errors, ...photoInspection.warnings],
                metrics_json: photoInspection.metrics,
              },
            });
          }
          if (student.status === "IMPORTED") {
            await tx.student.update({ where: { id: studentId }, data: { status: "DRAFT" } });
          }
          await tx.auditLog.create({
            data: {
              actor_type: "STUDENT",
              actor_id: studentId,
              action: "FILE_UPLOADED",
              entity_type: "FileRecord",
              entity_id: created.id,
              request_id: id,
              after_json: {
                category,
                version: created.current_version,
                status: created.status,
                checksum: created.checksum,
                width: created.width,
                height: created.height,
                ip: getClientIp(request.headers),
              },
            },
          });
          return created;
        });
      } catch (error) {
        if (!isUniqueConflict(error) || attempt === 2) throw error;
      }
    }
    if (!fileRecord) throw new Error("Unable to create file record");
    storageKey = null;
    return NextResponse.json({
      success: true,
      fileRecord: {
        id: fileRecord.id,
        category: fileRecord.category,
        status: fileRecord.status,
        currentVersion: fileRecord.current_version,
        width: fileRecord.width,
        height: fileRecord.height,
        url: `/api/student/files/${fileRecord.id}`,
      },
      validation: photoInspection
        ? { errors: photoInspection.errors, warnings: photoInspection.warnings, metrics: photoInspection.metrics }
        : undefined,
    });
  } catch (error) {
    if (storageKey) await deletePrivateFile(storageKey).catch(() => undefined);
    logServerError("Student file upload error", error, id);
    return NextResponse.json(publicServerError(id), { status: 500 });
  }
}
