import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exportQueueConnection } from "@/services/queue/exportQueue";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    exportQueueConnection.ping(),
    prisma.student.count({
      where: { current_cccd: { not: null }, current_cccd_lookup: null },
    }),
    prisma.admissionRecord.count({
      where: {
        OR: [
          { cccd_source_lookup: null },
          { full_name_search_tokens: { isEmpty: true } },
          {
            middle_school_source: { not: null },
            middle_school_lookup: null,
          },
          {
            middle_school_commune_source: { not: null },
            middle_school_commune_lookup: null,
          },
          { ethnicity_source: { not: null }, ethnicity_lookup: null },
        ],
      },
    }),
  ]);
  const database = checks[0].status === "fulfilled";
  const redis = checks[1].status === "fulfilled";
  const missingStudentIndexes =
    checks[2].status === "fulfilled" ? checks[2].value : null;
  const missingAdmissionIndexes =
    checks[3].status === "fulfilled" ? checks[3].value : null;
  const searchIndexes =
    missingStudentIndexes === 0 && missingAdmissionIndexes === 0;
  const ready = database && redis && searchIndexes;
  return NextResponse.json(
    {
      status: ready ? "ready" : "not-ready",
      database,
      redis,
      searchIndexes,
      missingStudentIndexes,
      missingAdmissionIndexes,
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
