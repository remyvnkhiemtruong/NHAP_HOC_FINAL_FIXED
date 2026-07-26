import {
  validateCCCD,
  OFFICIAL_EXCEPTIONS,
} from "../lib/validations/cccdValidator";

describe("CCCD Validator", () => {
  describe("Basic Format", () => {
    it.each([
      ["", false, "CCCD không được để trống"],
      [
        "0",
        false,
        "CCCD bằng 0 (Ngoại lệ TT 829) cần được Admin cập nhật số đúng",
      ],
      ["12345", false, "CCCD phải đủ 12 chữ số"],
      ["abcdefghijkl", false, "CCCD phải đủ 12 chữ số"],
    ])("CCCD %s -> isValid: %s", (cccd, expectedValid, expectedError) => {
      const res = validateCCCD(cccd);
      expect(res.isValid).toBe(expectedValid);
      if (expectedError) {
        expect(res.errors).toContain(expectedError);
      }
    });
  });

  describe("Official Flags", () => {
    if (OFFICIAL_EXCEPTIONS.length === 0) {
      it("has no hard-coded CCCD exceptions", () => {
        expect(OFFICIAL_EXCEPTIONS).toEqual([]);
      });
    } else {
      it.each(OFFICIAL_EXCEPTIONS)(
        "CCCD ngoại lệ %s always passes semantic checks",
        (cccd) => {
          const res = validateCCCD(cccd, "Nam", "2010");
          expect(res.isValid).toBe(true);
          expect(res.warnings).toContain(
            "CCCD thuộc danh sách ngoại lệ được duyệt",
          );
          expect(res.errors.length).toBe(0);
        },
      );
    }
  });

  describe("Semantic Validation", () => {
    it.each([
      // CCCD, Gender, DOB, expectedValid, expectedErrorMsg
      ["079210123456", "Nam", "15/10/2010", true, ""], // Đúng giới tính (2) và đúng năm sinh (10)
      ["079310123456", "Nữ", "15/10/2010", true, ""], // Đúng giới tính (3) và đúng năm sinh (10)
      [
        "999210123456",
        "Nam",
        "15/10/2010",
        false,
        "3 số đầu CCCD không đúng mã tỉnh/thành",
      ],
      [
        "079310123456",
        "Nam",
        "15/10/2010",
        true,
        "Ký tự giới tính/thế kỷ trong CCCD (3) không khớp với giới tính Nam",
      ],
      [
        "079211123456",
        "Nam",
        "15/10/2010",
        true,
        "2 số năm sinh trong CCCD (11) không khớp với năm sinh 2010",
      ],
    ])("CCCD %s, %s, %s", (cccd, gender, dob, expectedValid, errorMsg) => {
      const res = validateCCCD(cccd, gender, dob);
      expect(res.isValid).toBe(expectedValid);
      if (errorMsg) {
        expect(
          [...res.errors, ...res.warnings].some((e) => e.includes(errorMsg)),
        ).toBe(true);
      }
    });
  });
});
