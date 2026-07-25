import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({ page: z.coerce.number().int().positive().default(1) });

export async function GET(request: Request) {
  const session = await getSession("admin_session");
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  const take = 20;
  const [items, total] = await Promise.all([
    prisma.exportJob.findMany({ orderBy: { created_at: "desc" }, skip: (query.data.page - 1) * take, take }),
    prisma.exportJob.count(),
  ]);
  return NextResponse.json({ success: true, items: items.map((job) => ({ id: job.id, type: job.type, status: job.status, progress: job.progress, filename: job.output_filename, createdAt: job.created_at, ready: job.status === "COMPLETED", hasErrorReport: Boolean(job.error_report_key) })), pagination: { page: query.data.page, pageSize: take, total } });
}
