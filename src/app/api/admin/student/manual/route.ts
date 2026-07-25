import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { StudentStatus } from "@/generated/prisma/enums";
import { getOfficialProfilePrefill } from "@/lib/student/officialProfilePrefill";
import { getHiddenFieldDefaults } from "@/lib/student/profileDefaults";
import { ADMISSION_FIELD_CODES } from "@/lib/student/admissionProfile";

export async function POST(request: Request) {
  try {
    const session = await getSession("admin_session");
    if (!session?.userId || !session.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fullName, cccd, dob, middleSchool } = body;

    if (!fullName || !cccd || !dob) {
      return NextResponse.json({ error: "Họ tên, CCCD, và ngày sinh là bắt buộc." }, { status: 400 });
    }

    if (!/^\d{12}$/.test(cccd)) {
      return NextResponse.json({ error: "CCCD phải là 12 chữ số." }, { status: 400 });
    }

    // Check if student with this CCCD already exists
    const existing = await prisma.student.findUnique({ where: { current_cccd: cccd } });
    if (existing) {
      return NextResponse.json({ error: "Học sinh với CCCD này đã tồn tại trong hệ thống." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Find or create manual batch
      let batch = await tx.importBatch.findUnique({ where: { checksum: "MANUAL_ENTRY_BATCH" } });
      if (!batch) {
        batch = await tx.importBatch.create({
          data: {
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
        }
      });

      const student = await tx.student.create({
        data: {
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
      const hidden = getHiddenFieldDefaults({ fullName });

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
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Manual add error:", error);
    return NextResponse.json({ error: "Lỗi hệ thống khi thêm học sinh." }, { status: 500 });
  }
}
