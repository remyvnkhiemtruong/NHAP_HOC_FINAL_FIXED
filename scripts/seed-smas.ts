import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as XLSX from "xlsx";
import { prisma } from "../src/lib/prisma";
import { upsertImportedData } from "../src/services/import/upsertService";
import { ensureDefaultCampaign } from "../src/lib/campaign";
import type { ParsedAdmissionRow } from "../src/services/import/excelParser";

function parseCellString(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === undefined || cell.v === null) return "";
  return String(cell.w ?? cell.v).trim().replaceAll(/\s+/g, " ");
}

function formatDate(day: number, month: number, year: number): string {
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function parseDob(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === undefined || cell.v === null) return "";
  if (typeof cell.v === "number") {
    const parsed = XLSX.SSF.parse_date_code(cell.v);
    return parsed ? formatDate(parsed.d, parsed.m, parsed.y) : "";
  }
  const value = String(cell.w ?? cell.v).trim();
  const match = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(value);
  if (match) return formatDate(Number(match[1]), Number(match[2]), Number(match[3]));
  return value;
}

async function main() {
  const filePath = path.join(process.cwd(), "00_INPUTS/02_MAU_XUAT_95_COT_SMAS_MOET.xlsx");
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }
  
  const buffer = fs.readFileSync(filePath);
  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, cellFormula: false, cellHTML: false });
  const sheet = workbook.Sheets["DanhSachHocSinh"];
  
  if (!sheet) {
      console.error("Sheet DanhSachHocSinh not found!");
      return;
  }
  
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:CQ1");
  const rows: ParsedAdmissionRow[] = [];
  
  console.log("Parsing SMAS export file...");
  
  // SMAS starts at index 4 (row 5)
  for (let rowIndex = 4; rowIndex <= range.e.r; rowIndex += 1) {
    const rowNumber = rowIndex + 1;
    const tt = parseCellString(sheet[XLSX.utils.encode_cell({ c: 0, r: rowIndex })]);
    if (!tt) continue;
    
    // c:56 is Số CMND/CCCD
    let rawCccd = parseCellString(sheet[XLSX.utils.encode_cell({ c: 56, r: rowIndex })]).replaceAll(" ", "");
    if (!rawCccd) rawCccd = "0"; // If no CCCD, use "0" to indicate it needs correction as per application logic
    
    // c:2 is Họ và tên học sinh
    const fullName = parseCellString(sheet[XLSX.utils.encode_cell({ c: 2, r: rowIndex })]);
    // c:6 is Giới tính (Nam/Nữ)
    const gender = parseCellString(sheet[XLSX.utils.encode_cell({ c: 6, r: rowIndex })]);
    const femaleMark = gender.toLowerCase() === "nữ" ? "x" : null;
    
    // c:5 is Ngày sinh
    const dob = parseDob(sheet[XLSX.utils.encode_cell({ c: 5, r: rowIndex })]);
    
    // c:22 is Dân tộc
    const ethnicity = parseCellString(sheet[XLSX.utils.encode_cell({ c: 22, r: rowIndex })]);
    
    // c:11 is Tỉnh thành thường trú
    const province = parseCellString(sheet[XLSX.utils.encode_cell({ c: 11, r: rowIndex })]);
    const commune = parseCellString(sheet[XLSX.utils.encode_cell({ c: 12, r: rowIndex })]);
    const residence = `${commune}, ${province}`;
    
    const note = parseCellString(sheet[XLSX.utils.encode_cell({ c: 10, r: rowIndex })]); // Trạng thái
    
    // Create minimal json source
    const sourceJson = {
       A: tt,
       B: rawCccd,
       C: fullName,
       E: dob,
    };
    
    rows.push({
      source_row_number: rowNumber,
      source_tt: tt,
      cccd_source: rawCccd,
      full_name_source: fullName,
      female_mark_source: femaleMark,
      dob_source: dob,
      ethnicity_source: ethnicity || null,
      residence_source: residence || null,
      middle_school_source: null,
      middle_school_commune_source: null,
      four_year_average: 0,
      four_year_conduct: 0,
      priority_score: 0,
      encouragement_score: 0,
      admission_score: 0,
      note_source: note || null,
      source_json: sourceJson,
      data_quality_flags: null,
      validation_errors: []
    });
  }
  
  const parseResult = {
    checksum: checksum + "_smas", // Avoid collision
    originalFileName: "02_MAU_XUAT_95_COT_SMAS_MOET.xlsx",
    sheetName: "DanhSachHocSinh",
    totalRows: rows.length,
    validRows: rows.length,
    warningRows: 0,
    errorRows: 0,
    rows
  };
  
  console.log(`Parsed ${parseResult.totalRows} rows. Importing to DB...`);
  const campaign = await ensureDefaultCampaign();
  const result = await upsertImportedData(parseResult, "vvk_sysadmin", campaign.id, { idempotent: true });
  console.log("Import completed:", result);
}

main()
  .catch((error) => {
    console.error("Failed to import:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
