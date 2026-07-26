import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { StudentStatus } from "@/generated/prisma/enums";
import { ParseResult } from "./excelParser";
import { getHiddenFieldDefaults } from "@/lib/student/profileDefaults";
import { getOfficialProfilePrefill } from "@/lib/student/officialProfilePrefill";
import { ADMISSION_FIELD_CODES } from "@/lib/student/admissionProfile";
import { blindIndex } from "@/lib/encryption";
import { nameSearchTokens } from "@/lib/searchIndexes";

type ImportOptions = { idempotent?: boolean };

function profileSeedFields(row: ParseResult["rows"][number]) {
  const official = getOfficialProfilePrefill({
    cccd: row.cccd_source,
    fullName: row.full_name_source,
    dateOfBirth: row.dob_source,
    femaleMark: row.female_mark_source,
    ethnicity: row.ethnicity_source,
    residenceCommune: row.residence_source,
  });
  const admission = [
    {
      fieldCode: ADMISSION_FIELD_CODES.middleSchool,
      value: row.middle_school_source ?? "",
    },
    {
      fieldCode: ADMISSION_FIELD_CODES.middleSchoolCommune,
      value: row.middle_school_commune_source ?? "",
    },
    {
      fieldCode: ADMISSION_FIELD_CODES.fourYearAverage,
      value: row.four_year_average.toString(),
    },
    {
      fieldCode: ADMISSION_FIELD_CODES.fourYearConduct,
      value: row.four_year_conduct.toString(),
    },
    {
      fieldCode: ADMISSION_FIELD_CODES.priorityScore,
      value: row.priority_score.toString(),
    },
    {
      fieldCode: ADMISSION_FIELD_CODES.encouragementScore,
      value: row.encouragement_score.toString(),
    },
    {
      fieldCode: ADMISSION_FIELD_CODES.admissionScore,
      value: row.admission_score.toString(),
    },
    {
      fieldCode: ADMISSION_FIELD_CODES.note,
      value: row.note_source ?? "",
    },
  ];
  return [
    ...official,
    ...admission,
  ].filter((field) => field.value !== "");
}

async function createMissingProfileValues(
  transaction: Prisma.TransactionClient,
  studentId: string,
  row: ParseResult["rows"][number],
  admissionDate: Date,
) {
  await transaction.studentProfileValue.createMany({
    data: profileSeedRows(studentId, row, admissionDate),
    skipDuplicates: true,
  });
}

function profileSeedRows(
  studentId: string,
  row: ParseResult["rows"][number],
  admissionDate: Date,
) {
  const fields = [
    ...profileSeedFields(row).map((field) => ({
      field_code: field.fieldCode,
      value: field.value,
    })),
    ...getHiddenFieldDefaults({ fullName: row.full_name_source, admissionDate }).filter(
      (field) => field.value !== "",
    ),
  ];
  return fields.map((field) => ({
    student_id: studentId,
    field_code: field.field_code,
    source_value: field.value,
    proposed_value: field.value,
    change_status: "UNCHANGED" as const,
  }));
}

export async function upsertImportedData(
  parseResult: ParseResult,
  adminUsername: string,
  campaignId: string,
  options: ImportOptions = {},
) {
  const campaign = await prisma.admissionCampaign.findUniqueOrThrow({
    where: { id: campaignId },
    select: { admission_date: true },
  });
  // Check if batch already exists by checksum
  const existingBatch = await prisma.importBatch.findFirst({
    where: { campaign_id: campaignId, checksum: parseResult.checksum },
  });

  if (existingBatch) {
    if (options.idempotent) {
      await prisma.$transaction(
        async (transaction) => {
          const admissionRecords =
            await transaction.admissionRecord.findMany({
              where: { import_batch_id: existingBatch.id },
              include: { student: true },
            });
          const rowByNumber = new Map(
            parseResult.rows.map((row) => [row.source_row_number, row]),
          );
          const studentIds = admissionRecords.flatMap((record) =>
            record.student ? [record.student.id] : [],
          );
          const existingValues =
            await transaction.studentProfileValue.findMany({
              where: { student_id: { in: studentIds } },
              select: { student_id: true, field_code: true },
            });
          const existingKeys = new Set(
            existingValues.map(
              (value) => `${value.student_id}\u0000${value.field_code}`,
            ),
          );
          const missingValues = admissionRecords.flatMap((record) => {
            const row = rowByNumber.get(record.source_row_number);
            if (!record.student || !row) return [];
            return profileSeedRows(record.student.id, row, campaign.admission_date).filter(
              (value) =>
                !existingKeys.has(
                  `${value.student_id}\u0000${value.field_code}`,
                ),
            );
          });
          if (missingValues.length > 0) {
            await transaction.studentProfileValue.createMany({
              data: missingValues,
              skipDuplicates: true,
            });
          }
        },
        { maxWait: 10000, timeout: 180000 },
      );
      return { success: true, reusedBatch: true, batchId: existingBatch.id };
    }
    throw new Error("File này đã được import trước đó.");
  }

  const identifiers = parseResult.rows
    .filter((row) => row.validation_errors.length === 0 && row.cccd_source !== "0")
    .map((row) => ({
      row: row.source_row_number,
      cccd: row.cccd_source,
      lookup: blindIndex(row.cccd_source, "current_cccd_lookup:v1"),
    }));
  const conflicts = await prisma.student.findMany({
    where: {
      campaign_id: campaignId,
      current_cccd_lookup: { in: identifiers.map((item) => item.lookup) },
    },
    select: { current_cccd_lookup: true },
  });
  const conflictLookups = new Set(conflicts.map((item) => item.current_cccd_lookup));
  const conflictRows = identifiers.filter((item) => conflictLookups.has(item.lookup));
  if (conflictRows.length > 0) {
    const error = new Error(`CCCD đã tồn tại trong đợt tuyển sinh tại dòng: ${conflictRows.map((item) => item.row).join(", ")}`);
    Object.assign(error, { code: "IMPORT_CCCD_CONFLICT", conflicts: conflictRows.map(({ row }) => ({ row })) });
    throw error;
  }

  // Run in transaction
  const batchId = await prisma.$transaction(
    async (tx) => {
      // 1. Create ImportBatch
      const batch = await tx.importBatch.create({
        data: {
          campaign_id: campaignId,
          original_filename: parseResult.originalFileName,
          checksum: parseResult.checksum,
          sheet_name: parseResult.sheetName,
          total_rows: parseResult.totalRows,
          valid_rows: parseResult.validRows,
          warning_rows: parseResult.warningRows,
          error_rows: parseResult.errorRows,
          imported_by: adminUsername,
        },
      });

      // 2. Process each row
      for (const row of parseResult.rows) {
        if (row.validation_errors.length > 0) {
          // Skip invalid rows?
          // According to requirement, only error rows are skipped from student creation
          // But we still save AdmissionRecord for traceback
        }

        // Upsert AdmissionRecord (no unique constraint except id, so just create)
        const admissionRecord = await tx.admissionRecord.create({
          data: {
            import_batch_id: batch.id,
            source_row_number: row.source_row_number,
            source_tt: row.source_tt,
            cccd_source: row.cccd_source,
            full_name_source: row.full_name_source,
            female_mark_source: row.female_mark_source,
            dob_source: row.dob_source,
            ethnicity_source: row.ethnicity_source,
            residence_source: row.residence_source,
            middle_school_source: row.middle_school_source,
            middle_school_commune_source: row.middle_school_commune_source,
            score_fields: {
              four_year_average: row.four_year_average,
              four_year_conduct: row.four_year_conduct,
              priority_score: row.priority_score,
              encouragement_score: row.encouragement_score,
              admission_score: row.admission_score,
            },
            note_source: row.note_source,
            source_json: row.source_json,
            data_quality_flags: row.data_quality_flags ?? Prisma.JsonNull,
            full_name_search_tokens: nameSearchTokens(row.full_name_source),
            middle_school_lookup: row.middle_school_source
              ? blindIndex(row.middle_school_source.toLocaleLowerCase("vi-VN"), "middle_school:v1")
              : null,
            middle_school_commune_lookup: row.middle_school_commune_source
              ? blindIndex(row.middle_school_commune_source.toLocaleLowerCase("vi-VN"), "middle_school_commune:v1")
              : null,
            ethnicity_lookup: row.ethnicity_source
              ? blindIndex(row.ethnicity_source.toLocaleLowerCase("vi-VN"), "ethnicity:v1")
              : null,
          },
        });

        // Skip student creation if it has hard validation errors (not warnings)
        if (row.validation_errors.length > 0) continue;

        const studentIdentifier = row.cccd_source === "0" ? null : row.cccd_source;

        const status =
          row.cccd_source === "0"
            ? StudentStatus.NEEDS_CCCD_CORRECTION
            : StudentStatus.IMPORTED;

        const student = await tx.student.create({
          data: {
            campaign_id: campaignId,
            current_cccd: studentIdentifier,
            current_dob: row.dob_source,
            admission_record_id: admissionRecord.id,
            status,
          },
        });

        await createMissingProfileValues(tx, student.id, row, campaign.admission_date);
      }
      return batch.id;
    },
    {
      maxWait: 10000,
      timeout: 180000,
    },
  );

  return { success: true, batchId };
}
