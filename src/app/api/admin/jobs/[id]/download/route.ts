import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { readExportFile } from '@/lib/server/fileStorage';

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
  const buffer = await readExportFile(key);
  const filename = report ? 'bao_cao_loi_export.csv' : job.output_filename ?? 'export.bin';
  return new Response(new Uint8Array(buffer), { headers: { 'Content-Type': report ? 'text/csv; charset=utf-8' : 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` } });
}
