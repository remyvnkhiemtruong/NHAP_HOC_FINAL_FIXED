import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const directory = path.dirname(fileURLToPath(import.meta.url));
const input = path.join(directory, "..", "00_INPUTS", "02_MAU_XUAT_95_COT_SMAS_MOET.xlsx");
const output = path.join(directory, "..", "src", "lib", "catalogs", "administrative.ts");
const workbook = XLSX.readFile(input, { raw: true });
const provinceRows = XLSX.utils.sheet_to_json(workbook.Sheets.TinhThanh, { header: 1, defval: "" });
const communeRows = XLSX.utils.sheet_to_json(workbook.Sheets.XaPhuong, { header: 1, defval: "" });

const text = (value) => String(value ?? "").trim();
const code = (value, length) => text(value).padStart(length, "0");
const comparableName = (value) =>
  text(value)
    .replace(/^(Tỉnh|Tp|Thành phố)\s+/u, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("vi-VN");
const provinces = provinceRows
  .slice(3)
  .map((row) => ({ code: code(row[1], 2), name: text(row[2]) }))
  .filter((item) => item.code && item.code !== "N/A" && item.name && item.name !== "N/A");
const provinceCodeByName = new Map(provinces.map((item) => [comparableName(item.name), item.code]));
const communes = communeRows
  .slice(3)
  .map((row) => ({
    code: code(row[0], 5),
    name: text(row[1]),
    provinceName: text(row[2]),
    provinceCode: provinceCodeByName.get(comparableName(row[2])) ?? "",
  }))
  .filter((item) => item.code && item.name && item.provinceCode);

if (provinces.length !== 34 || communes.length === 0) {
  throw new Error(`Unexpected catalog data: ${provinces.length} provinces, ${communes.length} communes.`);
}

const source = `// Generated from 00_INPUTS/02_MAU_XUAT_95_COT_SMAS_MOET.xlsx. Do not edit manually.\n\n` +
  `export type ProvinceOption = Readonly<{ code: string; name: string }>;\n` +
  `export type CommuneOption = Readonly<{ code: string; name: string; provinceCode: string; provinceName: string }>;\n\n` +
  `export const PROVINCES: readonly ProvinceOption[] = ${JSON.stringify(provinces, null, 2)} as const;\n\n` +
  `export const COMMUNES: readonly CommuneOption[] = ${JSON.stringify(communes, null, 2)} as const;\n\n` +
  `function comparableName(value: string): string {\n` +
  `  return value.trim().replace(/^(Tỉnh|Tp|Thành phố)\\s+/u, "").normalize("NFD").replace(/\\p{Diacritic}/gu, "").toLocaleLowerCase("vi-VN");\n}\n\n` +
  `export function findProvinceByName(name: string | undefined | null): ProvinceOption | undefined {\n` +
  `  return name ? PROVINCES.find((province) => comparableName(province.name) === comparableName(name)) : undefined;\n}\n\n` +
  `export function getCommunesByProvinceName(name: string | undefined | null): readonly CommuneOption[] {\n` +
  `  const province = findProvinceByName(name);\n  return province ? COMMUNES.filter((commune) => commune.provinceCode === province.code) : [];\n}\n`;

fs.writeFileSync(output, source, "utf8");
console.log(`Generated ${provinces.length} provinces and ${communes.length} communes.`);
