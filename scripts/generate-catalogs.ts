import fs from 'fs';
import path from 'path';

const CATALOGS_DIR = path.join(__dirname, '../03_REFERENCE_CATALOGS');
const OUT_DIR = path.join(__dirname, '../src/lib/catalogs');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// 1. ETHNICITIES
const ethMd = fs.readFileSync(path.join(CATALOGS_DIR, '01_ETHNICITIES_54.md'), 'utf-8');
const ethLines = ethMd.split('\n').filter(line => line.startsWith('|') && !line.includes('code | name') && !line.includes('---'));
const ethnicities = ethLines.map(line => {
  const parts = line.split('|').map(s => s.trim());
  return { code: parts[1], name: parts[2], displayOrder: parseInt(parts[3], 10) };
}).filter(e => e.code);

fs.writeFileSync(path.join(OUT_DIR, 'ethnicities.ts'), `export interface Ethnicity {
  code: string;
  name: string;
  displayOrder: number;
}

export const ETHNICITIES: Ethnicity[] = ${JSON.stringify(ethnicities, null, 2)};
`);

// 2. RELIGIONS
const relMd = fs.readFileSync(path.join(CATALOGS_DIR, '02_RELIGIONS_17.md'), 'utf-8');
const relLines = relMd.split('\n').filter(line => line.startsWith('|') && !line.includes('code | name') && !line.includes('---'));
const religions = relLines.map(line => {
  const parts = line.split('|').map(s => s.trim());
  return { code: parts[1], name: parts[2], displayOrder: parseInt(parts[3], 10) };
}).filter(e => e.code);

fs.writeFileSync(path.join(OUT_DIR, 'religions.ts'), `export interface Religion {
  code: string;
  name: string;
  displayOrder: number;
}

export const RELIGIONS: Religion[] = ${JSON.stringify(religions, null, 2)};
`);

// 3. DROPDOWNS
const ddMd = fs.readFileSync(path.join(CATALOGS_DIR, '03_ALL_DROPDOWNS_EXACT.md'), 'utf-8');
const dropdowns: Record<string, string[]> = {};
let currentKey = '';
const keyMap: Record<string, string> = {
  'Lớp': 'classes',
  'Hình thức trúng tuyển': 'admissionMethods',
  'Đối tượng chính sách': 'policyObjects',
  'Chế độ chính sách': 'policyRegimes',
  'Trạng thái học sinh': 'studentStatuses',
  'Diện học sinh': 'studentTypes',
  'Khu vực': 'areas',
  'Loại khuyết tật': 'disabilityTypes',
  'Loại tốt nghiệp cấp dưới': 'lowerGraduationTypes',
  'Hệ học ngoại ngữ': 'foreignLanguageYears',
  'Diện ưu tiên, khuyến khích': 'priorityTypes',
  'Hướng nghiệp dạy nghề': 'vocationalTraining',
  'Số buổi học trên tuần': 'sessionsPerWeek',
  'Lý do bán trú': 'boardingReasons',
  'Nhóm máu': 'bloodTypes',
  'Có/Không': 'yesNo',
  'Giới tính': 'genders'
};

ddMd.split('\n').forEach(line => {
  if (line.startsWith('## ')) {
    const title = line.replace('## ', '').trim();
    currentKey = keyMap[title];
    if (currentKey) dropdowns[currentKey] = [];
  } else if (currentKey && /^\d+\.\s/.test(line)) {
    dropdowns[currentKey].push(line.replace(/^\d+\.\s/, '').trim());
  }
});

fs.writeFileSync(path.join(OUT_DIR, 'dropdowns.ts'), `export const DROPDOWNS = ${JSON.stringify(dropdowns, null, 2)};
`);

// 4. PHONE PREFIXES
const phoneMd = fs.readFileSync(path.join(CATALOGS_DIR, '04_PHONE_PREFIXES.md'), 'utf-8');
const phoneLines = phoneMd.split('\n').filter(line => line.startsWith('|') && !line.includes('operator | prefix') && !line.includes('---'));
const phonePrefixes = phoneLines.map(line => {
  const parts = line.split('|').map(s => s.trim());
  return { operator: parts[1], prefix: parts[2], note: parts[3] };
}).filter(e => e.operator);

// sort by prefix length descending
phonePrefixes.sort((a, b) => b.prefix.length - a.prefix.length);

fs.writeFileSync(path.join(OUT_DIR, 'phone-prefixes.ts'), `export interface PhonePrefix {
  operator: string;
  prefix: string;
  note: string;
}

export const PHONE_PREFIXES: PhonePrefix[] = ${JSON.stringify(phonePrefixes, null, 2)};

export function getOperator(phoneNumber: string): string | null {
  const cleanNumber = phoneNumber.replace(/\\D/g, '');
  if (cleanNumber.length !== 10) return null;
  const match = PHONE_PREFIXES.find(p => cleanNumber.startsWith(p.prefix));
  return match ? match.operator : null;
}
`);

// 5. CCCD 63 CODES
const cccd63Md = fs.readFileSync(path.join(CATALOGS_DIR, '05_CCCD_63_CODES.md'), 'utf-8');
const cccd63Lines = cccd63Md.split('\n').filter(line => line.startsWith('|') && !line.includes('code | name') && !line.includes('---'));
const cccd63: Record<string, string> = {};
cccd63Lines.forEach(line => {
  const parts = line.split('|').map(s => s.trim());
  if (parts[1]) cccd63[parts[1]] = parts[2];
});

fs.writeFileSync(path.join(OUT_DIR, 'cccd-63-codes.ts'), `export const CCCD_63_CODES: Record<string, string> = ${JSON.stringify(cccd63, null, 2)};
`);

// 6. CCCD 34 CURRENT MAPPING
const cccd34Md = fs.readFileSync(path.join(CATALOGS_DIR, '06_CCCD_34_CURRENT_MAPPING.md'), 'utf-8');
const cccd34Lines = cccd34Md.split('\n').filter(line => line.startsWith('|') && !line.includes('currentProvince |') && !line.includes('---'));
const cccd34 = cccd34Lines.map(line => {
  const parts = line.split('|').map(s => s.trim());
  if (!parts[1]) return null;
  // REMOVE BRACKETS AND QUOTES CORRECTLY
  let legacyCodesStr = parts[2];
  legacyCodesStr = legacyCodesStr.replace('[', '').replace(']', '').replace(/'/g, '');
  const legacyCodes = legacyCodesStr.split(',').map(s => s.trim());
  
  return { currentProvince: parts[1], acceptedLegacyCodes: legacyCodes, legacySources: parts[3] };
}).filter(e => e !== null);

fs.writeFileSync(path.join(OUT_DIR, 'cccd-34-mapping.ts'), `export interface ProvinceMapping {
  currentProvince: string;
  acceptedLegacyCodes: string[];
  legacySources: string;
}

export const CCCD_34_CURRENT_MAPPING: ProvinceMapping[] = ${JSON.stringify(cccd34, null, 2)};
`);

// INDEX
fs.writeFileSync(path.join(OUT_DIR, 'index.ts'), `export * from './ethnicities';
export * from './religions';
export * from './dropdowns';
export * from './phone-prefixes';
export * from './cccd-63-codes';
export * from './cccd-34-mapping';
`);

console.log('Catalogs generated successfully!');
