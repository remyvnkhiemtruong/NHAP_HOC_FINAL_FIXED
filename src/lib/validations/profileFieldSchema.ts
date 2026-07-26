import { z } from "zod";
import { isValidPhone } from "./phoneValidator";
import { parseVietnameseDate } from "@/lib/student/profileRules";

const NAME_FIELDS = new Set(["C", "AK", "AQ", "AW"]);
const EMAIL_FIELDS = new Set(["BI", "AO", "AU", "BA"]);
const PHONE_FIELDS = new Set(["AF", "AN", "AT", "AZ"]);
const CCCD_FIELDS = new Set(["BF", "AP", "AV", "BB"]);
const DATE_FIELDS = new Set(["F", "BG", "V", "BL"]);
const YEAR_FIELDS = new Set(["AL", "AR", "AX"]);
const ADDRESS_FIELDS = new Set(["L", "N", "O", "U", "CG", "CH"]);
const BOOLEAN_FIELDS = new Set([
  "has_policy",
  "is_doi_vien",
  "is_doan_vien",
  "cha_da_mat",
  "me_da_mat",
  "giong_thuong_tru",
]);

export function profileFieldValueSchema(fieldCode: string): z.ZodType<string> {
  const schema = z.string().trim();
  if (BOOLEAN_FIELDS.has(fieldCode)) {
    return schema.refine((value) => value === "true" || value === "false", "Giá trị boolean không hợp lệ.");
  }
  if (NAME_FIELDS.has(fieldCode)) return schema.max(150, "Họ tên vượt quá 150 ký tự.");
  if (EMAIL_FIELDS.has(fieldCode)) {
    return schema.max(254).refine((value) => !value || z.email().safeParse(value).success, "Email không hợp lệ.");
  }
  if (PHONE_FIELDS.has(fieldCode)) {
    return schema.refine((value) => !value || isValidPhone(value), "Số điện thoại không hợp lệ.");
  }
  if (CCCD_FIELDS.has(fieldCode)) {
    return schema.refine((value) => !value || /^\d{12}$/.test(value), "CCCD phải gồm đúng 12 chữ số.");
  }
  if (DATE_FIELDS.has(fieldCode)) {
    return schema.refine((value) => !value || Boolean(parseVietnameseDate(value)), "Ngày phải theo định dạng dd/mm/yyyy và tồn tại.");
  }
  if (YEAR_FIELDS.has(fieldCode)) {
    return schema.refine(
      (value) =>
        !value ||
        (/^(19|20)\d{2}$/.test(value) &&
          Number(value) <= new Date().getFullYear()),
      "Năm sinh không hợp lệ.",
    );
  }
  if (fieldCode === "G") {
    return schema.refine((value) => ["Nam", "Nữ"].includes(value), "Giới tính không hợp lệ.");
  }
  if (ADDRESS_FIELDS.has(fieldCode)) return schema.max(500, "Địa chỉ vượt quá 500 ký tự.");
  return schema.max(2_000, "Giá trị vượt quá 2.000 ký tự.");
}

export function validateProfileFieldMap(fields: Record<string, string>): string | null {
  for (const [fieldCode, value] of Object.entries(fields)) {
    const result = profileFieldValueSchema(fieldCode).safeParse(value);
    if (!result.success) return result.error.issues[0]?.message ?? "Giá trị trường không hợp lệ.";
  }
  return null;
}
