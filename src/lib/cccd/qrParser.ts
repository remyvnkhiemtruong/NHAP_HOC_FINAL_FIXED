export interface ParsedQrData {
  cccd?: string;
  oldId?: string;
  fullName?: string;
  dob?: string;
  gender?: string;
  address?: string;
  issueDate?: string;
}

function isValidDate(value: string, maximumYear: number): boolean {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  if (year < 1900 || year > maximumYear || month < 1 || month > 12) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseCccdQr(rawPayload: string): ParsedQrData {
  const result: ParsedQrData = {};
  if (!rawPayload) return result;

  const parts = rawPayload.split("|").map((part) => part.trim());
  if (/^\d{12}$/.test(parts[0] ?? "")) result.cccd = parts[0];

  if (parts.length >= 7) {
    if (/^\d{12}$/.test(parts[0])) result.cccd = parts[0];
    result.oldId = parts[1];
    result.fullName = parts[2] || undefined;
    result.dob = isValidDate(parts[3], new Date().getFullYear()) ? parts[3] : undefined;
    result.gender = parts[4] || undefined;
    result.address = parts[5] || undefined;
    result.issueDate = isValidDate(parts[6], new Date().getFullYear() + 1) ? parts[6] : undefined;
    return result;
  }

  const currentYear = new Date().getFullYear();
  const dobIndex = parts.findIndex((part) => isValidDate(part, currentYear));
  if (dobIndex > 0) {
    result.fullName = parts[dobIndex - 1] || undefined;
    result.dob = parts[dobIndex];
    result.gender = parts[dobIndex + 1] || undefined;
  }
  return result;
}
