import { blindIndex } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { nameSearchTokens } from "@/lib/searchIndexes";

export async function backfillSearchIndexes(): Promise<{
  studentsUpdated: number;
  admissionRecordsUpdated: number;
}> {
  const students = await prisma.student.findMany({
    where: { current_cccd: { not: null }, current_cccd_lookup: null },
    select: { id: true, current_cccd: true },
  });
  for (const student of students) {
    if (!student.current_cccd) continue;
    await prisma.student.update({
      where: { id: student.id },
      data: { current_cccd: student.current_cccd },
    });
  }

  const records = await prisma.admissionRecord.findMany({
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
        {
          ethnicity_source: { not: null },
          ethnicity_lookup: null,
        },
      ],
    },
  });
  for (const record of records) {
    await prisma.admissionRecord.update({
      where: { id: record.id },
      data: {
        cccd_source: record.cccd_source,
        full_name_search_tokens: nameSearchTokens(record.full_name_source),
        middle_school_lookup: record.middle_school_source
          ? blindIndex(
              record.middle_school_source.toLocaleLowerCase("vi-VN"),
              "middle_school:v1",
            )
          : null,
        middle_school_commune_lookup: record.middle_school_commune_source
          ? blindIndex(
              record.middle_school_commune_source.toLocaleLowerCase("vi-VN"),
              "middle_school_commune:v1",
            )
          : null,
        ethnicity_lookup: record.ethnicity_source
          ? blindIndex(
              record.ethnicity_source.toLocaleLowerCase("vi-VN"),
              "ethnicity:v1",
            )
          : null,
      },
    });
  }

  const [studentsMissingLookup, recordsMissingLookup] = await Promise.all([
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
  if (studentsMissingLookup > 0 || recordsMissingLookup > 0) {
    throw new Error(
      `Search-index backfill incomplete: students=${studentsMissingLookup}, admissionRecords=${recordsMissingLookup}`,
    );
  }
  return {
    studentsUpdated: students.length,
    admissionRecordsUpdated: records.length,
  };
}
