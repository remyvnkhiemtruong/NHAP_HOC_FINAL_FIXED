export const EXCEL_FIELD_CODES = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 
  'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 
  'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 
  'BK', 'BL', 'BM', 'BN', 'BO', 'BP', 'BQ', 'BR', 'BS', 'BT', 'BU', 'BV', 'BW', 'BX', 'BY', 'BZ', 'CA', 'CB', 'CC', 
  'CD', 'CE', 'CF', 'CG', 'CH', 'CI', 'CJ', 'CK', 'CL', 'CM', 'CN', 'CO', 'CP', 'CQ',
] as const;

import { stripLocationCode } from "@/lib/utils/stringUtils";

export type ExcelFieldCode = (typeof EXCEL_FIELD_CODES)[number];
export type ExcelCellValue = string | Date;

export type EffectiveProfileValue = {
  field_code: string;
  source_value: string | null;
  approved_value: string | null;
  change_status: 'UNCHANGED' | 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'ADMIN_EDITED';
};

type FamilyMember = {
  type: 'FATHER' | 'MOTHER' | 'GUARDIAN';
  absent_or_deceased: boolean;
  full_name: string | null;
  birth_year: string | null;
  occupation: string | null;
  phone: string | null;
  email: string | null;
  cccd: string | null;
};

type Address = {
  address_type: string;
  province_name_snapshot: string | null;
  commune_code: string | null;
  commune_name_snapshot: string | null;
  hamlet: string | null;
  detailed_text: string | null;
};

type PolicyRecord = { has_policy: boolean; description: string | null; policy_regime: string | null };
type Disability = { has_disability: boolean; disability_type: string | null; not_assessed: boolean };

export type SchoolExcelStudent = {
  current_cccd: string | null;
  current_dob: string;
  admission_record: { full_name_source: string };
  profile_values: readonly EffectiveProfileValue[];
  addresses: readonly Address[];
  family_members: readonly FamilyMember[];
  policy_records: readonly PolicyRecord[];
  disabilities: readonly Disability[];
};

const LOCKED_DEFAULTS: Partial<Record<ExcelFieldCode, string | Date>> = {
  I: 'Xét tuyển',
  J: new Date(2026, 8, 5),
  K: 'Đang học',
  AB: 'Không',
  AC: 'Đồng bằng',
  AI: 'Có',
  BQ: 'Không',
  BR: 'Trực tiếp',
  BV: 'Không',
  BW: 'Không',
  BX: 'Không',
  BZ: 'Không',
  CA: 'Không',
  CB: 'Không',
  CC: 'Không',
  CD: 'Không',
  CF: 'Không',
  CM: 'Có',
  CN: 'Không',
  CO: 'Không',
};

const TECHNICAL_EMPTY_FIELDS: readonly ExcelFieldCode[] = ['B', 'E', 'BP', 'CL', 'CP', 'CQ'];
const DATE_FIELDS = new Set<ExcelFieldCode>(['F', 'J', 'V', 'BG', 'BL', 'BP']);

type FamilyColumns = {
  name: ExcelFieldCode;
  birthYear: ExcelFieldCode;
  occupation: ExcelFieldCode;
  phone: ExcelFieldCode;
  email: ExcelFieldCode;
  cccd?: ExcelFieldCode;
};

const FAMILY_COLUMNS: Record<FamilyMember['type'], FamilyColumns> = {
  FATHER: { name: 'AK', birthYear: 'AL', occupation: 'AM', phone: 'AN', email: 'AO', cccd: 'AP' },
  MOTHER: { name: 'AQ', birthYear: 'AR', occupation: 'AS', phone: 'AT', email: 'AU', cccd: 'AV' },
  GUARDIAN: { name: 'AW', birthYear: 'AX', occupation: 'AY', phone: 'AZ', email: 'BA' },
};

export function effectiveValue(values: readonly EffectiveProfileValue[], code: string): string {
  const value = values.find((entry) => entry.field_code === code);
  if (!value) return '';
  if (value.change_status === 'ACCEPTED' || value.change_status === 'ADMIN_EDITED') {
    return value.approved_value ?? value.source_value ?? '';
  }
  return value.source_value ?? '';
}

function lastWord(value: string): string {
  return value.trim().split(/\s+/).at(-1) ?? '';
}

export function toExcelDate(value: string): Date | null {
  const vietnameseDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!vietnameseDate && !isoDate) return null;
  const [, yearText, monthText, dayText] = isoDate ?? [undefined, vietnameseDate?.[3], vietnameseDate?.[2], vietnameseDate?.[1]];
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function setFamilyFallback(
  values: Record<ExcelFieldCode, ExcelCellValue>,
  member: FamilyMember | undefined,
  columns: FamilyColumns,
): void {
  if (!member || member.absent_or_deceased) return;
  values[columns.name] ||= member.full_name ?? '';
  values[columns.birthYear] ||= member.birth_year ?? '';
  values[columns.occupation] ||= member.occupation ?? '';
  values[columns.phone] ||= member.phone ?? '';
  values[columns.email] ||= member.email ?? '';
  if (columns.cccd) values[columns.cccd] ||= member.cccd ?? '';
}

export function mapSchoolExcelRow(student: SchoolExcelStudent, rowNumber: number): ExcelCellValue[] {
  const field = (code: ExcelFieldCode): string => {
    const val = effectiveValue(student.profile_values, code);
    if (['L', 'N', 'CG', 'CH'].includes(code)) {
      return stripLocationCode(val);
    }
    return val;
  };
  const values = Object.fromEntries(EXCEL_FIELD_CODES.map((code) => [code, field(code)])) as Record<ExcelFieldCode, ExcelCellValue>;
  const permanent = student.addresses.find((address) => address.address_type === 'PERMANENT');
  const policy = student.policy_records.at(0);
  const disability = student.disabilities.at(0);

  values.A = String(rowNumber);
  values.C ||= student.admission_record.full_name_source;
  values.D = lastWord(String(values.C));
  values.F ||= student.current_dob;
  values.L ||= permanent?.province_name_snapshot || '';
  values.M ||= permanent?.commune_code ?? '';
  values.N = stripLocationCode((values.N as string) || permanent?.commune_name_snapshot || '');
  values.O ||= permanent?.hamlet ?? '';
  values.T = stripLocationCode((values.T as string) || permanent?.detailed_text || [values.O as string, values.N as string, values.L as string].filter(Boolean).join(', '));
  values.Y ||= policy?.has_policy ? policy.description ?? 'Có' : 'Không';
  values.Z ||= policy?.policy_regime ?? '';
  values.AE ||= disability?.has_disability ? disability.disability_type ?? '' : '';
  values.BM ||= disability?.not_assessed ? 'Có' : 'Không';
  values.BF ||= student.current_cccd || '';

  for (const type of Object.keys(FAMILY_COLUMNS) as FamilyMember['type'][]) {
    setFamilyFallback(values, student.family_members.find((member) => member.type === type), FAMILY_COLUMNS[type]);
  }
  for (const [code, value] of Object.entries(LOCKED_DEFAULTS) as [ExcelFieldCode, ExcelCellValue][]) values[code] = value;
  for (const code of TECHNICAL_EMPTY_FIELDS) values[code] = '';
  for (const code of DATE_FIELDS) {
    const value = values[code];
    if (typeof value === 'string') values[code] = toExcelDate(value) ?? value;
  }
  return EXCEL_FIELD_CODES.map((code) => values[code]);
}

export const EXCEL_TEXT_FIELDS: readonly ExcelFieldCode[] = ['B', 'E', 'M', 'AF', 'AG', 'AN', 'AP', 'AT', 'AV', 'AZ', 'BF', 'CJ', 'CL', 'CP', 'CQ'];
export const EXCEL_DATE_FIELDS: readonly ExcelFieldCode[] = ['F', 'J', 'V', 'BG', 'BL', 'BP'];
