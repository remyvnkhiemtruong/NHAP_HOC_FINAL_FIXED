import * as XLSX from "xlsx";
import { parseExcelBuffer } from "../services/import/excelParser";

function fixtureWorkbook(): Buffer {
  const rows = [
    ["TT", "CCCD", "Họ tên", "Nữ", "Ngày sinh", "Dân tộc", "Nơi ở", "THCS", "Địa bàn", "TB", "RL", "ƯT", "KK", "Xét tuyển", "Ghi chú"],
    [], [], [],
    ["1", "095211000001", "NGUYỄN VĂN A", "", "15/10/2011", "Kinh", "Xã Phước Long", "THCS A", "Xã Phước Long", 30, 8, 0, 1, 39, ""],
    ["2", "0", "TRẦN VĂN B", "", "01/01/2011", "Kinh", "Xã Phước Long", "THCS B", "Xã Phước Long", 29, 8, 1, 1, 39, ""],
    ["3", "095211000001", "LÊ VĂN C", "", "31/02/2011", "Kinh", "Xã Phước Long", "THCS C", "Xã Phước Long", 30, 8, 0, 0, 38, ""],
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Danh sách trúng tuyển");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

describe("Excel Parser", () => {
  it("parses valid rows, warnings and errors without mutating CCCD", async () => {
    const result = await parseExcelBuffer(fixtureWorkbook(), "fixture.xlsx");
    expect(result.sheetName).toBe("Danh sách trúng tuyển");
    expect(result.totalRows).toBe(3);
    expect(result.validRows).toBe(2);
    expect(result.warningRows).toBe(1);
    expect(result.errorRows).toBe(1);
    expect(result.rows[0].cccd_source).toBe("095211000001");
    expect(result.rows[1].cccd_source).toBe("0");
    expect(result.rows[1].data_quality_flags?.flags).toContain("CCCD_ZERO");
    expect(result.rows[2].validation_errors).toEqual(expect.arrayContaining([
      "CCCD bị trùng trong cùng file nhập.",
      "Ngày sinh không hợp lệ; yêu cầu dd/mm/yyyy.",
    ]));
  });
});
