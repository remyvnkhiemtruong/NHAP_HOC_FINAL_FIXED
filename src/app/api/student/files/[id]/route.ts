import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { readPrivateFile } from "@/lib/server/fileStorage";

function safeDownloadName(name: string): string {
  return name.replaceAll(/[\r\n"\\/]/g, "_").slice(0, 180) || "image.jpg";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = requestId(request.headers);
  try {
    const [{ id: fileId }, studentSession, adminSession] = await Promise.all([
      params,
      getSession("student_session"),
      getSession("admin_session"),
    ]);
    if (!studentSession && !adminSession) return new NextResponse("Unauthorized", { status: 401 });
    const fileRecord = await prisma.fileRecord.findFirst({
      where: { id: fileId, ...(studentSession ? { is_current: true } : {}) },
    });
    if (!fileRecord) return new NextResponse("File not found", { status: 404 });
    if (!adminSession && studentSession?.studentId !== fileRecord.student_id) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const buffer = await readPrivateFile(fileRecord.storage_key);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": fileRecord.mime,
        "Content-Disposition": `inline; filename="${safeDownloadName(fileRecord.original_name)}"`,
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logServerError("Read private file error", error, id);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
