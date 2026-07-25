import { parseVietnameseDate } from "./profileRules";

export type IssueDateParts = {
  year: string;
  month: string;
  day: string;
};

export function splitIssueDate(value: string | undefined): IssueDateParts {
  const parsed = value ? parseVietnameseDate(value) : null;
  return parsed
    ? {
        year: String(parsed.getUTCFullYear()),
        month: String(parsed.getUTCMonth() + 1).padStart(2, "0"),
        day: String(parsed.getUTCDate()).padStart(2, "0"),
      }
    : { year: "", month: "", day: "" };
}

export function joinIssueDate(parts: IssueDateParts): string {
  if (!parts.year || !parts.month || !parts.day) return "";
  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function issueYears(
  dateOfBirth: string | undefined,
  now = new Date(),
): number[] {
  const birth = dateOfBirth ? parseVietnameseDate(dateOfBirth) : null;
  const firstYear = birth?.getUTCFullYear() ?? 2000;
  const currentYear = now.getFullYear();
  return Array.from(
    { length: currentYear - firstYear + 1 },
    (_, index) => currentYear - index,
  );
}

export function daysInIssueMonth(year: string, month: string): number[] {
  if (!year || !month) return [];
  const count = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => index + 1);
}

export function isValidIssueDate(
  value: string,
  dateOfBirth: string | undefined,
  now = new Date(),
): boolean {
  const issue = parseVietnameseDate(value);
  const birth = dateOfBirth ? parseVietnameseDate(dateOfBirth) : null;
  if (!issue || !birth) return false;
  return issue.getTime() >= birth.getTime() && issue.getTime() <= now.getTime();
}
