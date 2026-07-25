import crypto from "crypto";
import * as XLSX from "xlsx";

export interface ParsedAdmissionRow {
  source_row_number: number;
  source_tt: string;
  cccd_source: string;
  full_name_source: string;
  female_mark_source: string | null;
  dob_source: string;
  ethnicity_source: string | null;
  residence_source: string | null;
  middle_school_source: string | null;
  middle_school_commune_source: string | null;
  four_year_average: number;
  four_year_conduct: number;
  priority_score: number;
  encouragement_score: number;
  admission_score: number;
  note_source: string | null;
  source_json: Record<string, string>;
  data_quality_flags: { flags: string[] } | null;
  validation_errors: string[];
}

export interface ParseResult {
  checksum: string;
  originalFileName: string;
  sheetName: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  rows: ParsedAdmissionRow[];
}

const REQUIRED_SHEET = "Danh sách trúng tuyển";
const MAX_IMPORT_ROWS = 5_000;

function parseCellString(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === undefined || cell.v === null) return "";
  return String(cell.w ?? cell.v).trim().replaceAll(/\s+/g, " ");
}

function parseCellNumber(cell: XLSX.CellObject | undefined): number {
  if (!cell || cell.v === undefined || cell.v === null || cell.v === "") return 0;
  const value = typeof cell.v === "number" ? cell.v : Number(String(cell.v).replace(",", "."));
  return Number.isFinite(value) ? value : Number.NaN;
}

function formatDate(day: number, month: number, year: number): string {
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function normalizeTextDate(value: string): string {
  const match = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(value.trim());
  if (!match) return value.trim();
  return formatDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

function parseDob(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === undefined || cell.v === null) return "";
  if (typeof cell.v === "number") {
    const parsed = XLSX.SSF.parse_date_code(cell.v);
    return parsed ? formatDate(parsed.d, parsed.m, parsed.y) : "";
  }
  return normalizeTextDate(String(cell.w ?? cell.v));
}

function validVietnameseDate(value: string): boolean {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;
  const day = Number(match[1]); const month = Number(match[2]); const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function sourceJson(sheet: XLSX.WorkSheet, row: number): Record<string, string> {
  return Object.fromEntries(Array.from({ length: 15 }, (_, column) => [
    XLSX.utils.encode_col(column),
    parseCellString(sheet[XLSX.utils.encode_cell({ c: column, r: row })]),
  ]));
}

export async function parseExcelBuffer(buffer: Buffer, originalFileName: string): Promise<ParseResult> {
  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, cellFormula: false, cellHTML: false });
  const sheet = workbook.Sheets[REQUIRED_SHEET];
  if (!sheet) throw new Error(`Không tìm thấy sheet "${REQUIRED_SHEET}".`);
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:O1");
  if (range.e.c > 40) throw new Error("File có quá nhiều cột so với mẫu nhập.");
  if (range.e.r - 3 > MAX_IMPORT_ROWS) throw new Error(`File vượt quá ${MAX_IMPORT_ROWS.toLocaleString("vi-VN")} dòng dữ liệu.`);

  const rows: ParsedAdmissionRow[] = [];
  const seenCccd = new Set<string>();
  for (let rowIndex = 4; rowIndex <= range.e.r; rowIndex += 1) {
    const rowNumber = rowIndex + 1;
    const tt = parseCellString(sheet[XLSX.utils.encode_cell({ c: 0, r: rowIndex })]);
    if (!tt) continue;
    const errors: string[] = [];
    const flags: string[] = [];
    const rawCccd = parseCellString(sheet[XLSX.utils.encode_cell({ c: 1, r: rowIndex })]).replaceAll(" ", "");
    const cccd = rawCccd;
    if (rawCccd === "0") flags.push("CCCD_ZERO");
    else if (!/^\d{12}$/.test(rawCccd)) errors.push("CCCD phải gồm đúng 12 chữ số và được định dạng dạng văn bản trong Excel.");
    else if (seenCccd.has(rawCccd)) errors.push("CCCD bị trùng trong cùng file nhập.");
    else seenCccd.add(rawCccd);

    const fullName = parseCellString(sheet[XLSX.utils.encode_cell({ c: 2, r: rowIndex })]);
    if (!fullName) errors.push("Họ và tên không được để trống.");
    const femaleMark = parseCellString(sheet[XLSX.utils.encode_cell({ c: 3, r: rowIndex })]);
    const isFemale = femaleMark.toLowerCase() === "x";
    const dob = parseDob(sheet[XLSX.utils.encode_cell({ c: 4, r: rowIndex })]);
    if (!validVietnameseDate(dob)) errors.push("Ngày sinh không hợp lệ; yêu cầu dd/mm/yyyy.");
    const ethnicity = parseCellString(sheet[XLSX.utils.encode_cell({ c: 5, r: rowIndex })]);
    const residence = parseCellString(sheet[XLSX.utils.encode_cell({ c: 6, r: rowIndex })]);
    const middleSchool = parseCellString(sheet[XLSX.utils.encode_cell({ c: 7, r: rowIndex })]);
    const middleSchoolCommune = parseCellString(sheet[XLSX.utils.encode_cell({ c: 8, r: rowIndex })]);
    const scores = [9, 10, 11, 12, 13].map((column) => parseCellNumber(sheet[XLSX.utils.encode_cell({ c: column, r: rowIndex })]));
    if (scores.some((score) => !Number.isFinite(score) || score < 0)) errors.push("Các cột điểm phải là số không âm.");
    const [fourYearAverage, fourYearConduct, priorityScore, encouragementScore, admissionScore] = scores.map((score) => Number.isFinite(score) ? score : 0);
    if (Math.abs(fourYearAverage + fourYearConduct + priorityScore + encouragementScore - admissionScore) > 0.01) {
      errors.push("Điểm xét tuyển không khớp tổng các điểm thành phần.");
    }
    if (/^\d{12}$/.test(cccd) && validVietnameseDate(dob)) {
      const year = Number(dob.slice(-4));
      const century = Math.floor((year - 1900) / 100);
      const expected = century * 2 + (isFemale ? 1 : 0);
      if (expected >= 0 && expected <= 9 && Number(cccd[3]) !== expected) flags.push("GENDER_MISMATCH");
    }
    const note = parseCellString(sheet[XLSX.utils.encode_cell({ c: 14, r: rowIndex })]);
    rows.push({
      source_row_number: rowNumber, source_tt: tt, cccd_source: cccd, full_name_source: fullName,
      female_mark_source: femaleMark || null, dob_source: dob, ethnicity_source: ethnicity || null,
      residence_source: residence || null, middle_school_source: middleSchool || null,
      middle_school_commune_source: middleSchoolCommune || null, four_year_average: fourYearAverage,
      four_year_conduct: fourYearConduct, priority_score: priorityScore, encouragement_score: encouragementScore,
      admission_score: admissionScore, note_source: note || null, source_json: sourceJson(sheet, rowIndex),
      data_quality_flags: flags.length ? { flags } : null, validation_errors: errors,
    });
  }
  const errorRows = rows.filter((row) => row.validation_errors.length > 0).length;
  const warningRows = rows.filter((row) => !row.validation_errors.length && row.data_quality_flags).length;
  return { checksum, originalFileName, sheetName: REQUIRED_SHEET, totalRows: rows.length, validRows: rows.length - errorRows, warningRows, errorRows, rows };
}
