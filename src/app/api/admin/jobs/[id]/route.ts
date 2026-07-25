import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const paramsSchema = z.object({ id: z.string().cuid() });
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession('admin_session');
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
  const job = await prisma.exportJob.findUnique({ where: { id: params.data.id } });
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, job: { id: job.id, type: job.type, status: job.status, progress: job.progress, filename: job.output_filename, ready: job.status === 'COMPLETED', hasErrorReport: Boolean(job.error_report_key) } });
}
