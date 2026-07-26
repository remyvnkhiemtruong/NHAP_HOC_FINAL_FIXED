import { createHash } from "node:crypto";
import { effectiveProfileValue } from "@/lib/student/effectiveProfileValue";

type ManifestStudent = {
  id: string;
  campaign_id: string;
  current_cccd: string | null;
  current_dob: string;
  admission_record: {
    cccd_source: string;
    full_name_source: string;
    female_mark_source: string | null;
    dob_source: string;
    ethnicity_source: string | null;
    residence_source: string | null;
    middle_school_source: string | null;
    middle_school_commune_source: string | null;
    score_fields: unknown;
    note_source: string | null;
    source_json: unknown;
  };
  profile_values: Array<{
    field_code: string;
    source_value: string | null;
    proposed_value: string | null;
    approved_value: string | null;
    change_status: string;
  }>;
  profile_versions: Array<{ version_number: number }>;
  files: Array<{
    id: string;
    category: string;
    checksum: string;
    current_version: number;
    status: string;
  }>;
};

export type ExportContentManifest = {
  version: 1;
  campaignId: string;
  students: Array<{
    studentId: string;
    profileVersion: number;
    profileHash: string;
    admissionRecordHash: string;
    files: Array<{
      id: string;
      category: string;
      version: number;
      checksum: string;
      status: string;
    }>;
  }>;
};

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function hashValue(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

export function buildExportContentManifest(
  campaignId: string,
  students: readonly ManifestStudent[],
): { manifest: ExportContentManifest; hash: string } {
  const manifest: ExportContentManifest = {
    version: 1,
    campaignId,
    students: [...students]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((student) => {
        const fields = [...student.profile_values]
          .sort((left, right) => left.field_code.localeCompare(right.field_code))
          .map((value) => [
            value.field_code,
            effectiveProfileValue(value),
          ]);
        const admission = student.admission_record;
        return {
          studentId: student.id,
          profileVersion: student.profile_versions[0]?.version_number ?? 0,
          profileHash: hashValue({
            currentCccd: student.current_cccd,
            currentDob: student.current_dob,
            fields,
          }),
          admissionRecordHash: hashValue({
            cccd: admission.cccd_source,
            fullName: admission.full_name_source,
            femaleMark: admission.female_mark_source,
            dob: admission.dob_source,
            ethnicity: admission.ethnicity_source,
            residence: admission.residence_source,
            middleSchool: admission.middle_school_source,
            middleSchoolCommune: admission.middle_school_commune_source,
            scores: admission.score_fields,
            note: admission.note_source,
            source: admission.source_json,
          }),
          files: [...student.files]
            .sort(
              (left, right) =>
                left.category.localeCompare(right.category) ||
                left.current_version - right.current_version ||
                left.id.localeCompare(right.id),
            )
            .map((file) => ({
              id: file.id,
              category: file.category,
              version: file.current_version,
              checksum: file.checksum,
              status: file.status,
            })),
        };
      }),
  };
  return { manifest, hash: hashValue(manifest) };
}
