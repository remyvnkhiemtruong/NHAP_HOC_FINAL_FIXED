const STUDENT_EDITABLE_FIELD_CODES = new Set([
  "BF",
  "BG",
  "C",
  "F",
  "G",
  "W",
  "L",
  "CG",
  "CH",
  "N",
  "O",
  "X",
  "V",
  "BL",
  "Y",
  "Z",
  "AE",
  "BM",
  "AH",
  "AJ",
  "AF",
  "BI",
  "AK",
  "AL",
  "AM",
  "AN",
  "AP",
  "AQ",
  "AR",
  "AS",
  "AT",
  "AV",
  "AW",
  "AX",
  "AY",
  "AZ",
  "BA",
  "BB",
  "BC",
  "BD",
  "BJ",
  "BN",
  "BO",
  "BE",
  "BS",
  "BT",
  "CE",
  "BY",
  "U",
]);

export const CCCD_ISSUERS = {
  MINISTRY_OF_PUBLIC_SECURITY: "Bộ Công an",
  ADMINISTRATIVE_POLICE_DEPARTMENT:
    "Cục Cảnh sát Quản lý Hành chính về Trật tự xã hội",
} as const;

export function isStudentEditableField(fieldCode: string): boolean {
  return STUDENT_EDITABLE_FIELD_CODES.has(fieldCode);
}

export function parseVietnameseDate(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
    ? date
    : null;
}

export function deriveCccdIssuer(issueDate: string): string {
  const date = parseVietnameseDate(issueDate);
  if (!date) return "";
  const threshold = Date.UTC(2024, 6, 1);
  return date.getTime() < threshold
    ? CCCD_ISSUERS.ADMINISTRATIVE_POLICE_DEPARTMENT
    : CCCD_ISSUERS.MINISTRY_OF_PUBLIC_SECURITY;
}
