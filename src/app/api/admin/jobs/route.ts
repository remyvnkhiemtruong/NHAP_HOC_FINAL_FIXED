import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadApprovedStudents } from "@/lib/server/exportService";
import { buildExportContentManifest } from "@/lib/server/exportManifest";

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
});

function cohortIds(payload: unknown): string[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const values = (payload as { cohortStudentIds?: unknown }).cohortStudentIds;
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === "string")
    .sort((left, right) => left.localeCompare(right));
}

export async function GET(request: Request) {
  const session = await getSession("admin_session");
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const query = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const take = 20;
  const [items, total] = await Promise.all([
    prisma.exportJob.findMany({
      include: { official_artifact: { select: { id: true } } },
      orderBy: { created_at: "desc" },
      skip: (query.data.page - 1) * take,
      take,
    }),
    prisma.exportJob.count(),
  ]);

  const eligibilityCache = new Map<string, Promise<boolean>>();
  const officialEligibility = await Promise.all(
    items.map(async (job) => {
      if (
        job.status !== "COMPLETED" ||
        job.official_artifact ||
        job.error_report_key ||
        !job.content_manifest ||
        !job.content_manifest_hash
      ) {
        return false;
      }
      const ids = cohortIds(job.payload_json);
      if (!ids.length) return false;
      const cacheKey = `${job.campaign_id}:${job.content_manifest_hash}:${ids.join(",")}`;
      let check = eligibilityCache.get(cacheKey);
      if (!check) {
        check = loadApprovedStudents(undefined, job.campaign_id, ids)
          .then((students) => {
            if (
              students.length !== ids.length ||
              students.some((student) => student.status !== "LOCKED")
            ) {
              return false;
            }
            return (
              buildExportContentManifest(job.campaign_id, students).hash ===
              job.content_manifest_hash
            );
          })
          .catch(() => false);
        eligibilityCache.set(cacheKey, check);
      }
      return check;
    }),
  );

  return NextResponse.json({
    success: true,
    items: items.map((job, index) => ({
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      filename: job.output_filename,
      createdAt: job.created_at,
      ready: job.status === "COMPLETED",
      hasErrorReport: Boolean(job.error_report_key),
      official: Boolean(job.official_artifact),
      officialEligible: officialEligibility[index],
    })),
    pagination: {
      page: query.data.page,
      pageSize: take,
      total,
    },
  });
}
