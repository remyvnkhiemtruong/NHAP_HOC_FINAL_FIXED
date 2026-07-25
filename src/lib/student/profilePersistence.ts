import { isStudentEditableField } from "@/lib/student/profileRules";

export const TRANSIENT_FORM_FIELDS = new Set([
  "has_policy",
  "is_doi_vien",
  "is_doan_vien",
  "cha_da_mat",
  "me_da_mat",
  "giong_thuong_tru",
]);

export function readPersistedFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([fieldCode, fieldValue]) => {
      if (TRANSIENT_FORM_FIELDS.has(fieldCode) && typeof fieldValue === "boolean") {
        return [[fieldCode, fieldValue ? "true" : "false"]];
      }
      if (!isStudentEditableField(fieldCode) || typeof fieldValue !== "string") return [];
      return [[fieldCode, fieldValue.slice(0, 5_000)]];
    }),
  );
}

export function coerceProfileFlags(fields: Record<string, string>): Record<string, string | boolean> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      TRANSIENT_FORM_FIELDS.has(key) ? value === "true" : value,
    ]),
  );
}
