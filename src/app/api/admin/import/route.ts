import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClientIp, logServerError, publicServerError, requestId } from "@/lib/http";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { validateXlsxArchive, XlsxArchiveError } from "@/lib/server/xlsxArchive";
import { parseExcelBuffer } from "@/services/import/excelParser";
import { upsertImportedData } from "@/services/import/upsertService";

const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function POST(request: Request) {
  const requestIdentifier = requestId(request.headers);
  try {
    const session = await getSession("admin_session");
    if (!session?.userId || !session.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_IMPORT_BYTES + 512 * 1024) return NextResponse.json({ error: "File nhập vượt quá giới hạn 20 MB." }, { status: 413 });
    const fileEntry = (await request.formData()).get("file");
    if (!(fileEntry instanceof File) || !fileEntry.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Cần tải lên một file Excel .xlsx hợp lệ." }, { status: 400 });
    }
    if (fileEntry.size === 0 || fileEntry.size > MAX_IMPORT_BYTES) return NextResponse.json({ error: "File phải có dung lượng từ 1 byte đến 20 MB." }, { status: 400 });
    if (fileEntry.type && fileEntry.type !== XLSX_MIME && fileEntry.type !== "application/octet-stream") {
      return NextResponse.json({ error: "Kiểu nội dung của file không phải XLSX." }, { status: 400 });
    }
    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    const archive = validateXlsxArchive(buffer);
    const parsed = await parseExcelBuffer(buffer, fileEntry.name.slice(0, 255));
    const imported = await upsertImportedData(parsed, session.username);
    await prisma.auditLog.create({
      data: {
        actor_type: "ADMIN", actor_id: session.userId, action: "ADMISSION_FILE_IMPORTED",
        entity_type: "ImportBatch", entity_id: imported.batchId, request_id: requestIdentifier,
        after_json: { checksum: parsed.checksum, totalRows: parsed.totalRows, validRows: parsed.validRows, warningRows: parsed.warningRows, errorRows: parsed.errorRows, archiveEntries: archive.entries, ip: getClientIp(request.headers) },
      },
    });
    return NextResponse.json({ success: true, reusedBatch: imported.reusedBatch ?? false, summary: { totalRows: parsed.totalRows, validRows: parsed.validRows, warningRows: parsed.warningRows, errorRows: parsed.errorRows } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "File này đã được import trước đó." }, { status: 409 });
    }
    if (error instanceof XlsxArchiveError || (error instanceof Error && /sheet|file|CCCD|dòng|cột|import trước/i.test(error.message))) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logServerError("Import error", error, requestIdentifier);
    return NextResponse.json(publicServerError(requestIdentifier), { status: 500 });
  }
}
