import type { ParseResult, ParsedAdmissionRow } from "../src/services/import/excelParser";

const baseRows = [
  { cccd: "095211000001", name: "NGUYỄN VĂN KIỂM THỬ 1", female: null, dob: "15/10/2011" },
  { cccd: "095311000002", name: "TRẦN THỊ KIỂM THỬ 2", female: "x", dob: "20/09/2011" },
  { cccd: "095211000003", name: "LÊ VĂN KIỂM THỬ 3", female: null, dob: "05/08/2011" },
  { cccd: "095311000004", name: "PHẠM THỊ KIỂM THỬ 4", female: "x", dob: "12/07/2011" },
  { cccd: "0", name: "HỒ SƠ CHƯA CÓ CCCD", female: null, dob: "01/01/2011" },
] as const;

export function createSyntheticAdmissionParseResult(): ParseResult {
  const rows: ParsedAdmissionRow[] = baseRows.map((item, index) => ({
    source_row_number: index + 5,
    source_tt: String(index + 1),
    cccd_source: item.cccd,
    full_name_source: item.name,
    female_mark_source: item.female,
    dob_source: item.dob,
    ethnicity_source: "Kinh",
    residence_source: "Xã Phước Long",
    middle_school_source: "THCS Kiểm Thử",
    middle_school_commune_source: "Xã Phước Long",
    four_year_average: 30,
    four_year_conduct: 8,
    priority_score: 0,
    encouragement_score: 1,
    admission_score: 39,
    note_source: null,
    source_json: { A: String(index + 1), B: item.cccd, C: item.name, E: item.dob },
    data_quality_flags: item.cccd === "0" ? { flags: ["CCCD_ZERO"] } : null,
    validation_errors: [],
  }));
  return {
    checksum: "synthetic-admission-fixture-v1",
    originalFileName: "synthetic-admission-fixture.xlsx",
    sheetName: "Danh sách trúng tuyển",
    totalRows: rows.length,
    validRows: rows.length,
    warningRows: 1,
    errorRows: 0,
    rows,
  };
}
