import { z } from "zod";

export const ADMISSION_FIELD_CODES = {
  middleSchool: "ADMISSION_H",
  middleSchoolCommune: "ADMISSION_I",
  fourYearAverage: "ADMISSION_J",
  fourYearConduct: "ADMISSION_K",
  priorityScore: "ADMISSION_L",
  encouragementScore: "ADMISSION_M",
  admissionScore: "ADMISSION_N",
  note: "ADMISSION_O",
} as const;

export type AdmissionFieldName = keyof typeof ADMISSION_FIELD_CODES;

export const admissionEditableSchema = z
  .object({
    middleSchool: z.string().trim().max(200).optional(),
    middleSchoolCommune: z.string().trim().max(200).optional(),
    fourYearAverage: z.string().trim().optional(),
    fourYearConduct: z.string().trim().optional(),
    priorityScore: z.string().trim().optional(),
    encouragementScore: z.string().trim().optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    for (const key of [
      "fourYearAverage",
      "fourYearConduct",
      "priorityScore",
      "encouragementScore",
    ] as const) {
      const raw = value[key];
      if (raw && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: "Điểm phải là số không âm.",
        });
      }
    }
  });

export type AdmissionEditableInput = z.infer<
  typeof admissionEditableSchema
>;

export interface AdmissionFormData extends AdmissionEditableInput {
  sourceTt: string;
  cccd: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  ethnicity: string;
  residenceCommune: string;
  admissionScore: string;
}

export function calculateAdmissionScore(
  input: Pick<
    AdmissionEditableInput,
    | "fourYearAverage"
    | "fourYearConduct"
    | "priorityScore"
    | "encouragementScore"
  >,
): string {
  const total = [
    input.fourYearAverage,
    input.fourYearConduct,
    input.priorityScore,
    input.encouragementScore,
  ].reduce((sum, value) => sum + (value ? Number(value) : 0), 0);
  return Number(total.toFixed(2)).toString();
}

