import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { StudentStatus } from "@/generated/prisma/enums";
import { getOfficialProfilePrefill } from "@/lib/student/officialProfilePrefill";
import { getHiddenFieldDefaults } from "@/lib/student/profileDefaults";
import { ADMISSION_FIELD_CODES } from "@/lib/student/admissionProfile";
import { activeCampaign } from "@/lib/campaign";
import { blindIndex } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { acquireTransactionLock } from "@/lib/server/advisoryLock";
import { nameSearchTokens } from "@/lib/searchIndexes";
import { parseVietnameseDate } from "@/lib/student/profileRules";
import { validateCCCD } from "@/lib/validations/cccdValidator";
import { z } from "zod";

const bodySchema = z
  .object({
    fullName: z.string().trim().min(1).max(150),
    cccd: z.string().regex(/^\d{12}$/),
    dob: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
    middleSchool: z.string().trim().max(200).optional().default(""),
  })
  .strict()
  .superRefine((value, context) => {
    if (!parseVietnameseDate(value.dob)) {
      context.addIssue({
        code: "custom",
        path: ["dob"],
        message: "Ngày sinh phải theo định dạng dd/mm/yyyy và tồn tại.",
      });
    }
    const cccdValidation = validateCCCD(value.cccd, undefined, value.dob);
    for (const error of cccdValidation.errors) {
      context.addIssue({ code: "custom", path: ["cccd"], message: error });
    }
  });

export async function POST(request: Request) {
  try {
    const session = await getSession("admin_session");
    if (!session?.userId || !session.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dữ liệu học sinh không hợp lệ.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }
    const { fullName, cccd, dob, middleSchool } = parsed.data;

    const campaign = await activeCampaign();
    const cccdLookup = blindIndex(cccd, "current_cccd_lookup:v1");
    const result = await prisma.$transaction(async (tx) => {
      await acquireTransactionLock(tx, `manual-student:${campaign.id}`);
      const existing = await tx.student.findUnique({
        where: {
          campaign_id_current_cccd_lookup: {
            campaign_id: campaign.id,
            current_cccd_lookup: cccdLookup,
          },
        },
        select: { id: true },
      });
      if (existing) return { kind: "duplicate" as const };

      // Find or create manual batch
      let batch = await tx.importBatch.findUnique({
        where: { campaign_id_checksum: { campaign_id: campaign.id, checksum: "MANUAL_ENTRY_BATCH" } },
      });
      if (!batch) {
        batch = await tx.importBatch.create({
          data: {
            campaign_id: campaign.id,
            checksum: "MANUAL_ENTRY_BATCH",
            original_filename: "Nhập thủ công",
            sheet_name: "Thủ công",
            total_rows: 0,
            valid_rows: 0,
            warning_rows: 0,
            error_rows: 0,
            imported_by: session.username as string,
          }
        });
      }

      const count = await tx.admissionRecord.count({ where: { import_batch_id: batch.id } });
      const rowNumber = count + 1;

      // Update valid rows in batch
      await tx.importBatch.update({
        where: { id: batch.id },
        data: {
          total_rows: { increment: 1 },
          valid_rows: { increment: 1 }
        }
      });

      const admissionRecord = await tx.admissionRecord.create({
        data: {
          import_batch_id: batch.id,
          source_row_number: rowNumber,
          source_tt: rowNumber.toString(),
          cccd_source: cccd,
          full_name_source: fullName,
          female_mark_source: "", // unknown
          dob_source: dob,
          ethnicity_source: "",
          residence_source: "",
          middle_school_source: middleSchool || "",
          middle_school_commune_source: "",
          score_fields: {
            four_year_average: 0,
            four_year_conduct: 0,
            priority_score: 0,
            encouragement_score: 0,
            admission_score: 0,
          },
          note_source: "Nhập thủ công",
          source_json: { manual: true },
          data_quality_flags: Prisma.JsonNull,
          full_name_search_tokens: nameSearchTokens(fullName),
          middle_school_lookup: middleSchool
            ? blindIndex(String(middleSchool).toLocaleLowerCase("vi-VN"), "middle_school:v1")
            : null,
        }
      });

      const student = await tx.student.create({
        data: {
          campaign_id: campaign.id,
          current_cccd: cccd,
          current_dob: dob,
          admission_record_id: admissionRecord.id,
          status: StudentStatus.IMPORTED,
        }
      });

      // Generate seed rows
      const official = getOfficialProfilePrefill({
        cccd, fullName, dateOfBirth: dob, femaleMark: "", ethnicity: "", residenceCommune: ""
      });
      const hidden = getHiddenFieldDefaults({ fullName, admissionDate: campaign.admission_date });

      const fields = [
        ...official.map(f => ({ field_code: f.fieldCode, value: f.value })),
        { field_code: ADMISSION_FIELD_CODES.middleSchool, value: middleSchool || "" },
        ...hidden.map(f => ({ field_code: f.field_code, value: f.value }))
      ].filter(f => f.value !== "");
      
      const values = fields.map(f => ({
        student_id: student.id,
        field_code: f.field_code,
        source_value: f.value,
        proposed_value: f.value,
        change_status: "UNCHANGED" as const,
      }));

      await tx.studentProfileValue.createMany({
        data: values,
        skipDuplicates: true
      });
      return { kind: "ok" as const, studentId: student.id };
    });

    if (result.kind === "duplicate") {
      return NextResponse.json(
        { error: "Học sinh với CCCD này đã tồn tại trong hệ thống." },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true, studentId: result.studentId });
  } catch (error) {
    logger.error("Manual add error", { error });
    return NextResponse.json({ error: "Lỗi hệ thống khi thêm học sinh." }, { status: 500 });
  }
}
