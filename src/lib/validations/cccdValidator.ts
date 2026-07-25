import { CCCD_63_CODES } from "@/lib/catalogs/cccd-63-codes";
import { parseVietnameseDate } from "@/lib/student/profileRules";

export interface CCCDValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Exception values must be injected by deployment configuration, never stored
 * in the repository. The variable contains comma-separated 12-digit values.
 */
export const OFFICIAL_EXCEPTIONS = (process.env.CCCD_EXCEPTION_LIST ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => /^\d{12}$/.test(value));

function parseBirthYear(dob: string): number | null {
  const vnDate = parseVietnameseDate(dob);
  if (vnDate) return vnDate.getUTCFullYear();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim());
  if (!iso) return null;
  const [, year, month, day] = iso;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
    ? Number(year)
    : null;
}

function expectedGenderCenturyCode(gender: string, year: number): string | null {
  const normalized = gender.trim().toLocaleLowerCase("vi-VN");
  const isMale = normalized === "nam";
  const isFemale = normalized === "nữ" || normalized === "nu";
  if (!isMale && !isFemale) return null;
  const century = Math.floor(year / 100);
  if (century < 19 || century > 23) return null;
  const maleCode = (century - 19) * 2;
  return String(isMale ? maleCode : maleCode + 1);
}

export function validateCCCD(cccd: string, gender?: string, dob?: string): CCCDValidationResult {
  const result: CCCDValidationResult = { isValid: true, errors: [], warnings: [] };
  const normalized = cccd?.trim();
  if (!normalized) {
    return { isValid: false, errors: ["CCCD không được để trống"], warnings: [] };
  }
  if (normalized === "0") {
    return {
      isValid: false,
      errors: ["CCCD bằng 0 (Ngoại lệ TT 829) cần được Admin cập nhật số đúng"],
      warnings: [],
    };
  }
  if (!/^\d{12}$/.test(normalized)) {
    return { isValid: false, errors: ["CCCD phải đủ 12 chữ số"], warnings: [] };
  }

  if (OFFICIAL_EXCEPTIONS.includes(normalized)) {
    result.warnings.push("CCCD thuộc danh sách ngoại lệ được cấu hình và cần đối chiếu thủ công");
    return result;
  }

  const provinceCode = normalized.slice(0, 3);
  if (!CCCD_63_CODES[provinceCode]) {
    result.isValid = false;
    result.errors.push("3 số đầu CCCD không đúng mã tỉnh/thành");
  }

  const genderCenturyCode = normalized[3];
  const yearCode = normalized.slice(4, 6);
  const birthYear = dob ? parseBirthYear(dob) : null;
  if (dob && birthYear === null) {
    result.warnings.push("Ngày sinh không đúng định dạng để đối chiếu CCCD");
  }
  if (birthYear !== null) {
    if (yearCode !== String(birthYear).slice(-2)) {
      result.warnings.push(
        `2 số năm sinh trong CCCD (${yearCode}) không khớp với năm sinh ${birthYear}`,
      );
    }
    if (gender) {
      const expected = expectedGenderCenturyCode(gender, birthYear);
      if (expected && genderCenturyCode !== expected) {
        result.warnings.push(
          `Ký tự giới tính/thế kỷ trong CCCD (${genderCenturyCode}) không khớp với giới tính ${gender}`,
        );
      }
    }
  } else if (!/^[0-9]$/.test(genderCenturyCode)) {
    result.isValid = false;
    result.errors.push("Ký tự giới tính/thế kỷ trong CCCD không hợp lệ");
  }

  return result;
}
