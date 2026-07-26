import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getExportFileSize, streamExportFile } from '@/lib/server/fileStorage';
import { requestId } from '@/lib/http';

const paramsSchema = z.object({ id: z.string().cuid() });
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession('admin_session');
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = paramsSchema.safeParse(await context.params);
  const report = new URL(request.url).searchParams.get('report') === '1';
  if (!params.success) return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
  const job = await prisma.exportJob.findUnique({ where: { id: params.data.id } });
  const key = report ? job?.error_report_key : job?.output_key;
  if (!job || !key || (!report && job.status !== 'COMPLETED')) return NextResponse.json({ error: 'File not ready' }, { status: 409 });
  const rangeHeader = request.headers.get('range');
  const rangeMatch = rangeHeader ? /^bytes=(\d+)-(\d*)$/.exec(rangeHeader) : null;
  const requestedRange = rangeMatch
    ? { start: Number(rangeMatch[1]), end: rangeMatch[2] ? Number(rangeMatch[2]) : Number.MAX_SAFE_INTEGER }
    : undefined;
  let file;
  try {
    const totalSize = await getExportFileSize(key);
    const normalizedRange = requestedRange
      ? { start: requestedRange.start, end: Math.min(requestedRange.end, totalSize - 1) }
      : undefined;
    file = await streamExportFile(key, normalizedRange);
  } catch {
    return new Response(null, { status: 416 });
  }
  const filename = report ? 'bao_cao_loi_export.csv' : job.output_filename ?? 'export.bin';
  await prisma.auditLog.create({
    data: {
      actor_type: 'ADMIN',
      actor_id: session.userId,
      action: 'EXPORT_DOWNLOADED',
      entity_type: 'ExportJob',
      entity_id: job.id,
      request_id: requestId(request.headers),
      after_json: { report, range: rangeHeader ?? null },
    },
  });
  return new Response(file.stream, {
    status: requestedRange ? 206 : 200,
    headers: {
      'Content-Type': report ? 'text/csv; charset=utf-8' : 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': String(file.size),
      'Accept-Ranges': 'bytes',
      ...(requestedRange ? { 'Content-Range': `bytes ${requestedRange.start}-${requestedRange.start + file.size - 1}/${file.totalSize}` } : {}),
      'Cache-Control': 'no-store, private',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
