import { z } from "zod";

const accessSchema = z
  .object({
    cccd: z.string().regex(/^\d{12}$/),
    dob: z.string().regex(/^\d{8}$/),
  })
  .strict();

export function normalizeStudentAccessDob(value: string): string | null {
  const match = /^(\d{2})(\d{2})(\d{4})$/.exec(value);
  if (!match) return null;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${dayText}/${monthText}/${yearText}`;
}

export function parseStudentAccessPayload(value: unknown): {
  cccd: string;
  dob: string;
} | null {
  const result = accessSchema.safeParse(value);
  if (!result.success) return null;
  const dob = normalizeStudentAccessDob(result.data.dob);
  return dob ? { cccd: result.data.cccd, dob } : null;
}
