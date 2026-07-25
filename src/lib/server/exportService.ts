import { ZipArchive } from 'archiver';
import ExcelJS from 'exceljs';
import path from 'node:path';
import { PassThrough } from 'stream';
import { prisma } from '@/lib/prisma';
import { calculateChecksum, readPrivateFile } from './fileStorage';
import { generateStudentPdf } from './pdfExport';
import { normalizeImageToJpeg, normalizePhoto4x6ToJpeg } from './photoZipImage';
import PDFDocument from 'pdfkit';
import {
  effectiveValue,
  EXCEL_DATE_FIELDS,
  EXCEL_FIELD_CODES,
  EXCEL_TEXT_FIELDS,
  mapSchoolExcelRow,
  type SchoolExcelStudent,
} from './schoolExcelExport';

export { effectiveValue } from './schoolExcelExport';

export const EXPORTABLE_STATUSES = ['APPROVED', 'LOCKED', 'EXPORTED'] as const;
export const EXPORT_FILE_NAMES = {
  SCHOOL_EXCEL: 'Thong_tin_hoc_sinh_toan_truong_2026_2027.xlsx',
  BULK_STUDENT_PDF_ZIP: 'Phieu_thong_tin_hoc_sinh_toan_truong_2026_2027.zip',
  PHOTO_ZIP: 'Anh_4x6_toan_truong_2026_2027.zip',
  CCCD_ZIP: 'Anh_CCCD_toan_truong_2026_2027.zip',
  SCAN_REPORT_CSV: 'Bao_cao_quet_QR_OCR_toan_truong_2026_2027.csv',
  SCAN_REPORT_PDF: 'Bao_cao_quet_QR_OCR_toan_truong_2026_2027.pdf',
} as const;

type ExportFile = { category: string; storage_key: string; original_name: string; mime: string; status: string; current_version: number };

const VALID_EXPORT_FILE_STATUSES = new Set(['AUTO_VALID', 'ADMIN_APPROVED']);
const FORMULA_PREFIX = /^[=+@-]/;

export function isExportableStatus(status: string): boolean {
  return EXPORTABLE_STATUSES.includes(status as (typeof EXPORTABLE_STATUSES)[number]);
}

export function selectCurrentFiles(files: ExportFile[]): Map<string, ExportFile> {
  const selected = new Map<string, ExportFile>();
  for (const file of files) {
    const existing = selected.get(file.category);
    if (!existing || file.current_version > existing.current_version) selected.set(file.category, file);
  }
  for (const [category, file] of selected) {
    if (!VALID_EXPORT_FILE_STATUSES.has(file.status)) selected.delete(category);
  }
  return selected;
}

function safeCccdPathSegment(cccd: string): string {
  if (!/^\d{12}$/.test(cccd)) throw new Error('Invalid CCCD path segment');
  return cccd;
}

export function photoZipPath(cccd: string): string { return `${safeCccdPathSegment(cccd)}.jpg`; }
export function cccdZipPaths(cccd: string): { front: string; back: string } {
  const safe = safeCccdPathSegment(cccd);
  return { front: `${safe}/mat_truoc.jpg`, back: `${safe}/mat_sau.jpg` };
}

export type PreflightIssue = { cccd: string; fullName: string; code: 'CCCD_ZERO' | 'CCCD_MISSING' | 'CCCD_INVALID' | 'CCCD_DUPLICATE' | 'PHOTO_MISSING' | 'CCCD_FRONT_MISSING' | 'CCCD_BACK_MISSING' };

export function exportCccd(profileValues: Parameters<typeof effectiveValue>[0], currentCccd: string | null): string {
  return effectiveValue(profileValues, 'BF') || currentCccd || '';
}

export function preflightExport(records: Array<{ cccd: string; fullName: string; files: Map<string, ExportFile> }>, type: 'PHOTO_ZIP' | 'CCCD_ZIP'): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    if (!record.cccd) issues.push({ ...record, code: 'CCCD_MISSING' });
    else if (record.cccd === '0') issues.push({ ...record, code: 'CCCD_ZERO' });
    else if (!/^\d{12}$/.test(record.cccd)) issues.push({ ...record, code: 'CCCD_INVALID' });
    else if (seen.has(record.cccd)) issues.push({ ...record, code: 'CCCD_DUPLICATE' });
    seen.add(record.cccd);
    if (type === 'PHOTO_ZIP' && !record.files.has('PHOTO_4X6')) issues.push({ ...record, code: 'PHOTO_MISSING' });
    if (type === 'CCCD_ZIP' && !record.files.has('CCCD_FRONT')) issues.push({ ...record, code: 'CCCD_FRONT_MISSING' });
    if (type === 'CCCD_ZIP' && !record.files.has('CCCD_BACK')) issues.push({ ...record, code: 'CCCD_BACK_MISSING' });
  }
  return issues;
}

function safeSpreadsheetText(value: string): string {
  const normalized = value.replaceAll(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return FORMULA_PREFIX.test(normalized) ? `'${normalized}` : normalized;
}

export function buildErrorReport(issues: PreflightIssue[]): Buffer {
  const lines = ['CCCD,Họ và tên,Mã lỗi', ...issues.map((issue) => [issue.cccd, issue.fullName, issue.code]
    .map((value) => `"${safeSpreadsheetText(value).replaceAll('\"', '\"\"')}"`).join(','))];
  return Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
}

export async function loadApprovedStudents(studentId?: string) {
  return prisma.student.findMany({
    where: { status: { in: [...EXPORTABLE_STATUSES] }, ...(studentId ? { id: studentId } : {}) },
    include: { admission_record: true, profile_values: true, files: { include: { qr_scan_results: true, ocr_results: true } }, addresses: true, family_members: true, policy_records: true, disabilities: true },
    orderBy: { admission_record: { source_tt: 'asc' } },
  });
}

export type ExportStudent = Awaited<ReturnType<typeof loadApprovedStudents>>[number];

const DATA_START_ROW = 5;

function excelColumnNumber(code: string): number {
  return code.split('').reduce((column, character) => column * 26 + character.charCodeAt(0) - 64, 0);
}

function clearDataContents(sheet: ExcelJS.Worksheet): void {
  for (let rowNumber = DATA_START_ROW; rowNumber <= sheet.rowCount; rowNumber += 1) sheet.getRow(rowNumber).values = [];
}

export async function generateSchoolExcel(students: readonly SchoolExcelStudent[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(process.cwd(), '00_INPUTS', '02_MAU_XUAT_95_COT_SMAS_MOET.xlsx'));
  const sheet = workbook.getWorksheet('DanhSachHocSinh');
  if (!sheet) throw new Error('Excel template missing DanhSachHocSinh sheet');
  clearDataContents(sheet);
  const templateRow = sheet.getRow(DATA_START_ROW);
  students.forEach((student, index) => {
    const row = sheet.getRow(DATA_START_ROW + index);
    row.height = templateRow.height;
    mapSchoolExcelRow(student, index + 1).forEach((value, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      if (index > 0) cell.style = { ...templateRow.getCell(columnIndex + 1).style };
      cell.value = typeof value === 'string' ? safeSpreadsheetText(value) : value;
    });
  });
  for (const field of EXCEL_TEXT_FIELDS) sheet.getColumn(excelColumnNumber(field)).numFmt = '@';
  for (const field of EXCEL_DATE_FIELDS) sheet.getColumn(excelColumnNumber(field)).numFmt = 'dd/mm/yyyy';
  if (sheet.columnCount !== EXCEL_FIELD_CODES.length) throw new Error('Excel template must have exactly 95 columns');
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function archiveEntries(entries: Array<{ name: string; buffer: Buffer }>): Promise<Buffer> {
  const stream = new PassThrough(); const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  const archive = new ZipArchive({ zlib: { level: 9 } }); archive.pipe(stream);
  for (const entry of entries) {
    if (!entry.name || entry.name.startsWith('/') || entry.name.split('/').includes('..')) throw new Error('Unsafe archive entry name');
    archive.append(entry.buffer, { name: entry.name });
  }
  const finished = new Promise<Buffer>((resolve, reject) => { stream.on('end', () => resolve(Buffer.concat(chunks))); archive.on('error', reject); });
  await archive.finalize(); return finished;
}

export async function generateImageZip(students: Awaited<ReturnType<typeof loadApprovedStudents>>, type: 'PHOTO_ZIP' | 'CCCD_ZIP'): Promise<Buffer> {
  const entries: Array<{ name: string; buffer: Buffer }> = [];
  for (const student of students) {
    const cccd = exportCccd(student.profile_values, student.current_cccd); const files = selectCurrentFiles(student.files);
    if (type === 'PHOTO_ZIP') {
      const photo = files.get('PHOTO_4X6'); if (!photo) continue;
      entries.push({ name: photoZipPath(cccd), buffer: await normalizePhoto4x6ToJpeg(await readPrivateFile(photo.storage_key)) });
    } else {
      const front = files.get('CCCD_FRONT'); const back = files.get('CCCD_BACK'); if (!front || !back) continue;
      const paths = cccdZipPaths(cccd);
      entries.push({ name: paths.front, buffer: await normalizeImageToJpeg(await readPrivateFile(front.storage_key)) });
      entries.push({ name: paths.back, buffer: await normalizeImageToJpeg(await readPrivateFile(back.storage_key)) });
    }
  }
  return archiveEntries(entries);
}

export function preflightPdfZip(students: readonly ExportStudent[]): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const seen = new Set<string>();
  for (const student of students) {
    const cccd = exportCccd(student.profile_values, student.current_cccd);
    const fullName = effectiveValue(student.profile_values, 'C') || student.admission_record.full_name_source;
    const files = selectCurrentFiles(student.files);
    if (!cccd) issues.push({ cccd, fullName, code: 'CCCD_MISSING' });
    else if (cccd === '0') issues.push({ cccd, fullName, code: 'CCCD_ZERO' });
    else if (!/^\d{12}$/.test(cccd)) issues.push({ cccd, fullName, code: 'CCCD_INVALID' });
    else if (seen.has(cccd)) issues.push({ cccd, fullName, code: 'CCCD_DUPLICATE' });
    seen.add(cccd);
    if (!files.has('PHOTO_4X6')) issues.push({ cccd, fullName, code: 'PHOTO_MISSING' });
    if (!files.has('CCCD_FRONT')) issues.push({ cccd, fullName, code: 'CCCD_FRONT_MISSING' });
    if (!files.has('CCCD_BACK')) issues.push({ cccd, fullName, code: 'CCCD_BACK_MISSING' });
  }
  return issues;
}

export function studentsWithoutPreflightIssues(students: readonly ExportStudent[], issues: readonly PreflightIssue[]): ExportStudent[] {
  const blocked = new Set(issues.map((issue) => issue.cccd));
  return students.filter((student) => !blocked.has(exportCccd(student.profile_values, student.current_cccd)));
}

export async function generateBulkStudentPdfZip(students: readonly ExportStudent[]): Promise<Buffer> {
  const entries: Array<{ name: string; buffer: Buffer }> = [];
  for (const student of students) {
    const cccd = safeCccdPathSegment(exportCccd(student.profile_values, student.current_cccd));
    entries.push({ name: `Thong_tin_hoc_sinh_${cccd}.pdf`, buffer: await generatePdfForStudent(student) });
  }
  return archiveEntries(entries);
}

type ScanReportRow = { cccd: string; fullName: string; file: string; scan: string; result: string; createdAt: string };

function scanReportRows(students: readonly ExportStudent[]): ScanReportRow[] {
  return students.flatMap((student) => {
    const cccd = exportCccd(student.profile_values, student.current_cccd);
    const fullName = effectiveValue(student.profile_values, 'C') || student.admission_record.full_name_source;
    return student.files.flatMap((file) => [
      ...file.qr_scan_results.map((result) => ({ cccd, fullName, file: file.category, scan: 'QR', result: result.success ? 'Đọc được' : 'Không đọc được', createdAt: result.created_at.toISOString() })),
      ...file.ocr_results.map((result) => ({ cccd, fullName, file: file.category, scan: 'OCR', result: result.raw_text ? 'Có kết quả' : 'Không có kết quả', createdAt: result.created_at.toISOString() })),
    ]);
  });
}

export function generateScanReportCsv(students: readonly ExportStudent[]): Buffer {
  const rows = scanReportRows(students);
  const quote = (value: string) => `"${safeSpreadsheetText(value).replaceAll('\"', '\"\"')}"`;
  const lines = ['CCCD,Họ và tên,Tệp,Loại quét,Kết quả,Thời điểm', ...rows.map((row) => [row.cccd, row.fullName, fileCategoryForReport(row.file), row.scan, row.result, row.createdAt].map(quote).join(','))];
  return Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
}

function fileCategoryForReport(category: string): string {
  return category === 'CCCD_FRONT' ? 'CCCD mặt trước' : category === 'CCCD_BACK' ? 'CCCD mặt sau' : category === 'PHOTO_4X6' ? 'Ảnh 4×6' : category;
}

export async function generateScanReportPdf(students: readonly ExportStudent[]): Promise<Buffer> {
  const rows = scanReportRows(students);
  const document = new PDFDocument({ margin: 36, size: 'A4' });
  document.registerFont('NotoSans', path.join(process.cwd(), 'node_modules', '@fontsource', 'noto-sans', 'files', 'noto-sans-vietnamese-400-normal.woff'));
  document.registerFont('NotoSans-Bold', path.join(process.cwd(), 'node_modules', '@fontsource', 'noto-sans', 'files', 'noto-sans-vietnamese-700-normal.woff'));
  const chunks: Buffer[] = [];
  document.on('data', (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => { document.on('end', () => resolve(Buffer.concat(chunks))); document.on('error', reject); });
  document.font('NotoSans-Bold').fontSize(15).text('Báo cáo quét QR/OCR toàn trường');
  document.moveDown().font('NotoSans').fontSize(9);
  if (!rows.length) document.text('Chưa có kết quả quét QR/OCR cho các hồ sơ đủ điều kiện xuất.');
  for (const row of rows) document.text(`${row.cccd} · ${row.fullName} · ${fileCategoryForReport(row.file)} · ${row.scan}: ${row.result}`);
  document.end();
  return completed;
}

export async function generatePdfForStudent(student: Awaited<ReturnType<typeof loadApprovedStudents>>[number]): Promise<Buffer> {
  return generateStudentPdf({ student: { id: student.id, current_cccd: effectiveValue(student.profile_values, 'BF') || student.current_cccd || '', current_dob: effectiveValue(student.profile_values, 'F') || student.current_dob, status: student.status }, admission_record: { full_name_source: student.admission_record.full_name_source, cccd_source: student.admission_record.cccd_source, dob_source: student.admission_record.dob_source, ethnicity_source: student.admission_record.ethnicity_source, residence_source: student.admission_record.residence_source, middle_school_source: student.admission_record.middle_school_source, middle_school_commune_source: student.admission_record.middle_school_commune_source, score_fields: typeof student.admission_record.score_fields === 'object' && student.admission_record.score_fields !== null && !Array.isArray(student.admission_record.score_fields) ? student.admission_record.score_fields as Record<string, unknown> : null, note_source: student.admission_record.note_source, data_quality_flags: Array.isArray(student.admission_record.data_quality_flags) ? student.admission_record.data_quality_flags.map(String) : student.admission_record.data_quality_flags && typeof student.admission_record.data_quality_flags === 'object' && !Array.isArray(student.admission_record.data_quality_flags) && 'flags' in student.admission_record.data_quality_flags && Array.isArray((student.admission_record.data_quality_flags as { flags?: unknown }).flags) ? ((student.admission_record.data_quality_flags as { flags: unknown[] }).flags).map(String) : null, source_tt: student.admission_record.source_tt, female_mark_source: student.admission_record.female_mark_source }, profile_values: student.profile_values, files: student.files.map((file) => ({ ...file, category: file.category, qr_scan_results: file.qr_scan_results })), family_members: student.family_members, policy_records: student.policy_records, disabilities: student.disabilities });
}

export function outputChecksum(buffer: Buffer): string { return calculateChecksum(buffer); }
