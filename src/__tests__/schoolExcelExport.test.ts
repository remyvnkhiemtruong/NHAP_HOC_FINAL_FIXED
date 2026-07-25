import ExcelJS from "exceljs";
import {
  EXCEL_FIELD_CODES,
  effectiveValue,
  mapSchoolExcelRow,
  toExcelDate,
  type SchoolExcelStudent,
} from "@/lib/server/schoolExcelExport";
import { generateSchoolExcel } from "@/lib/server/exportService";

jest.mock("archiver", () => ({ ZipArchive: class {} }));
jest.mock("sharp", () => jest.fn());
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/server/pdfExport", () => ({ generateStudentPdf: jest.fn() }));

const student: SchoolExcelStudent = {
  current_cccd: "095311003768",
  current_dob: "03/02/2010",
  admission_record: { full_name_source: "Nguyễn Ngọc Minh Anh" },
  profile_values: [
    {
      field_code: "C",
      source_value: "Nguyễn Ngọc Minh Anh",
      approved_value: null,
      change_status: "UNCHANGED",
    },
    {
      field_code: "F",
      source_value: "03/02/2010",
      approved_value: null,
      change_status: "UNCHANGED",
    },
    {
      field_code: "BF",
      source_value: "095311003768",
      approved_value: "012345678901",
      change_status: "ACCEPTED",
    },
    {
      field_code: "AF",
      source_value: "0987000001",
      approved_value: null,
      change_status: "UNCHANGED",
    },
    {
      field_code: "AG",
      source_value: "095311003768",
      approved_value: null,
      change_status: "UNCHANGED",
    },
    {
      field_code: "M",
      source_value: "00123",
      approved_value: null,
      change_status: "UNCHANGED",
    },
    {
      field_code: "BJ",
      source_value: "Nguồn",
      approved_value: "Đề nghị",
      change_status: "PROPOSED",
    },
  ],
  addresses: [
    {
      address_type: "PERMANENT",
      province_name_snapshot: "Đà Nẵng",
      commune_code: "00123",
      commune_name_snapshot: "Hòa Xuân",
      hamlet: "Tổ 1",
      detailed_text: "Tổ 1, Hòa Xuân, Đà Nẵng",
    },
  ],
  family_members: [
    {
      type: "FATHER",
      absent_or_deceased: false,
      full_name: "Nguyễn Văn Cha",
      birth_year: "1978",
      occupation: "Giáo viên",
      phone: "0901000001",
      email: "cha@example.test",
      cccd: "001078000001",
    },
    {
      type: "MOTHER",
      absent_or_deceased: false,
      full_name: "Trần Thị Mẹ",
      birth_year: "1980",
      occupation: "Kế toán",
      phone: "0902000002",
      email: "me@example.test",
      cccd: "001080000002",
    },
    {
      type: "GUARDIAN",
      absent_or_deceased: false,
      full_name: "Lê Người Giám Hộ",
      birth_year: "1975",
      occupation: "Bác sĩ",
      phone: "0903000003",
      email: "giamho@example.test",
      cccd: null,
    },
  ],
  policy_records: [
    {
      has_policy: true,
      description: "Con thương binh",
      policy_regime: "Miễn giảm",
    },
  ],
  disabilities: [
    { has_disability: false, disability_type: null, not_assessed: false },
  ],
};

const valueAt = (row: ReturnType<typeof mapSchoolExcelRow>, code: string) =>
  row[EXCEL_FIELD_CODES.indexOf(code as (typeof EXCEL_FIELD_CODES)[number])];

describe("school Excel mapper", () => {
  it.each([
    ["UNCHANGED", "Nguồn"],
    ["PROPOSED", "Nguồn"],
    ["REJECTED", "Nguồn"],
    ["ACCEPTED", "Đã duyệt"],
    ["ADMIN_EDITED", "Đã duyệt"],
  ] as const)("uses the effective value for %s", (change_status, expected) => {
    expect(
      effectiveValue(
        [
          {
            field_code: "C",
            source_value: "Nguồn",
            approved_value: "Đã duyệt",
            change_status,
          },
        ],
        "C",
      ),
    ).toBe(expected);
  });

  it("maps defaults, technical empties, addresses, policy, TT 829 fields, and explicit family columns", () => {
    const row = mapSchoolExcelRow(student, 7);
    expect(row).toHaveLength(95);
    expect(valueAt(row, "A")).toBe("7");
    expect(valueAt(row, "D")).toBe("Anh");
    expect(valueAt(row, "I")).toBe("Xét tuyển");
    expect(valueAt(row, "K")).toBe("Đang học");
    expect(valueAt(row, "L")).toBe("Đà Nẵng");
    expect(valueAt(row, "M")).toBe("00123");
    expect(valueAt(row, "Y")).toBe("Con thương binh");
    expect(valueAt(row, "BF")).toBe("012345678901");
    expect(valueAt(row, "BJ")).toBe("Nguồn");
    expect(valueAt(row, "AQ")).toBe("Trần Thị Mẹ");
    expect(valueAt(row, "AR")).toBe("1980");
    expect(valueAt(row, "AV")).toBe("001080000002");
    expect(valueAt(row, "AW")).toBe("Lê Người Giám Hộ");
    expect(valueAt(row, "AZ")).toBe("0903000003");
    expect(valueAt(row, "B")).toBe("");
    expect(valueAt(row, "E")).toBe("");
    expect(valueAt(row, "BP")).toBe("");
    expect(valueAt(row, "CL")).toBe("");
    expect(valueAt(row, "CP")).toBe("");
    expect(valueAt(row, "CQ")).toBe("");
    expect(valueAt(row, "CM")).toBe("Có");
  });

  it("only converts valid calendar dates to Excel dates", () => {
    expect(toExcelDate("29/02/2024")).toEqual(new Date(2024, 1, 29));
    expect(toExcelDate("29/02/2023")).toBeNull();
    expect(toExcelDate("2026-09-05")).toEqual(new Date(2026, 8, 5));
  });
});

describe("school Excel workbook", () => {
  jest.setTimeout(120000);

  it("preserves the six-sheet template, validations, header, and typed data row", async () => {
    const output = await generateSchoolExcel([student]);
    const templateWorkbook = new ExcelJS.Workbook();
    await templateWorkbook.xlsx.readFile(
      "00_INPUTS/02_MAU_XUAT_95_COT_SMAS_MOET.xlsx",
    );
    const templateSheet = templateWorkbook.getWorksheet("DanhSachHocSinh");
    if (!templateSheet) throw new Error("Missing template DanhSachHocSinh");
    const workbook = new ExcelJS.Workbook();
    // exceljs bundles an older Buffer declaration than the Node 20 types used by this project.
    await workbook.xlsx.load(output as never);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "DanhSachHocSinh",
      "ref",
      "TinhThanh",
      "XaPhuong",
      "HuongDanChung - Validate",
      "version",
    ]);
    const sheet = workbook.getWorksheet("DanhSachHocSinh");
    expect(sheet).toBeDefined();
    if (!sheet) throw new Error("Missing DanhSachHocSinh");
    expect(sheet.columnCount).toBe(95);
    const headerValues = sheet.getRow(4).values;
    expect(
      Array.isArray(headerValues) ? headerValues.slice(1) : [],
    ).toHaveLength(95);
    const templateHeaderValues = templateSheet.getRow(4).values;
    const templateHeaders = Array.isArray(templateHeaderValues)
      ? templateHeaderValues.slice(1)
      : [];
    expect(Array.isArray(headerValues) ? headerValues.slice(1) : []).toEqual(
      templateHeaders,
    );
    const worksheetModel = sheet.model as unknown as {
      merges: string[];
      dataValidations: Record<string, unknown>;
    };
    expect(worksheetModel.merges).toHaveLength(2);
    expect(worksheetModel.dataValidations.AL5).toBeDefined();
    expect(sheet.getCell("A5").value).toBe("1");
    expect(sheet.getCell("D5").value).toBe("Anh");
    expect(sheet.getCell("M5").value).toBe("00123");
    expect(sheet.getCell("M5").numFmt).toBe("@");
    expect(sheet.getCell("BF5").value).toBe("012345678901");
    expect(sheet.getCell("BF5").numFmt).toBe("@");
    expect(sheet.getCell("F5").value).toBeInstanceOf(Date);
    expect(sheet.getCell("F5").numFmt).toBe("dd/mm/yyyy");
    expect(sheet.getCell("J5").value).toEqual(new Date(2026, 8, 5));
    expect(sheet.getCell("B5").value).toBe("");
    expect(sheet.getCell("E5").value).toBe("");
    expect(sheet.getCell("CP5").value).toBe("");
  });
});
