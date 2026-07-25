import type { Prisma } from "@/generated/prisma/client";
import { ADMISSION_FIELD_CODES } from "@/lib/student/admissionProfile";
import { getHiddenFieldDefaults } from "@/lib/student/profileDefaults";
import { getOfficialProfilePrefill } from "@/lib/student/officialProfilePrefill";

type SeedAdmissionRecord = {
  source_tt: string;
  cccd_source: string;
  full_name_source: string;
  female_mark_source: string | null;
  dob_source: string;
  ethnicity_source: string | null;
  residence_source: string | null;
  middle_school_source: string | null;
  middle_school_commune_source: string | null;
  score_fields: Prisma.JsonValue | null;
  note_source: string | null;
};

function scoreSource(record: SeedAdmissionRecord): Record<string, number> {
  return record.score_fields && typeof record.score_fields === "object" && !Array.isArray(record.score_fields)
    ? (record.score_fields as Record<string, number>)
    : {};
}

export function profileSeedRows(studentId: string, record: SeedAdmissionRecord) {
  const scores = scoreSource(record);
  const admission = {
    middleSchool: record.middle_school_source ?? "",
    middleSchoolCommune: record.middle_school_commune_source ?? "",
    fourYearAverage: String(scores.four_year_average ?? 0),
    fourYearConduct: String(scores.four_year_conduct ?? 0),
    priorityScore: String(scores.priority_score ?? 0),
    encouragementScore: String(scores.encouragement_score ?? 0),
    admissionScore: String(scores.admission_score ?? 0),
    note: record.note_source ?? "",
  };
  const official = getOfficialProfilePrefill({
    cccd: record.cccd_source,
    fullName: record.full_name_source,
    dateOfBirth: record.dob_source,
    femaleMark: record.female_mark_source,
    ethnicity: record.ethnicity_source,
    residenceCommune: record.residence_source,
  });
  return [
    ...official.map((field) => ({
      student_id: studentId,
      field_code: field.fieldCode,
      source_value: field.value,
      proposed_value: field.value,
      change_status: "UNCHANGED" as const,
    })),
    ...getHiddenFieldDefaults({ fullName: record.full_name_source })
      .filter((field) => field.value !== "")
      .map((field) => ({
        student_id: studentId,
        field_code: field.field_code,
        source_value: field.value,
        proposed_value: field.value,
        change_status: "UNCHANGED" as const,
      })),
    ...Object.entries(ADMISSION_FIELD_CODES).map(([name, fieldCode]) => ({
      student_id: studentId,
      field_code: fieldCode,
      source_value: admission[name as keyof typeof admission],
      proposed_value: admission[name as keyof typeof admission],
      change_status: "UNCHANGED" as const,
    })),
  ];
}
