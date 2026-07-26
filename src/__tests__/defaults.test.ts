import {
  extractFirstName,
  getHiddenFieldDefaults,
} from "../lib/student/profileDefaults";

describe("Hidden Fields & Defaults", () => {
  it("should extract first name correctly", () => {
    expect(extractFirstName("Nguyễn Ngọc Minh Anh")).toBe("Anh");
    expect(extractFirstName("Lê Văn Tèo")).toBe("Tèo");
    expect(extractFirstName("Hoàng")).toBe("Hoàng");
    expect(extractFirstName("")).toBe("");
  });

  it("should populate all hidden fields correctly", () => {
    const defaults = getHiddenFieldDefaults({
      fullName: "Nguyễn Văn A",
      admissionDate: new Date(2027, 7, 18),
    });

    const getVal = (code: string) =>
      defaults.find((d) => d.field_code === code)?.value;

    expect(getVal("D")).toBe("A");
    expect(getVal("I")).toBe("Xét tuyển");
    expect(getVal("J")).toBe("18/08/2027");

    // Đặc biệt kiểm tra BZ và CM theo yêu cầu
    expect(getVal("BZ")).toBe("Không"); // Học bán trú
    expect(getVal("CM")).toBe("Có"); // Học 2 buổi

    // Một số trường mặc định khác
    expect(getVal("AI")).toBe("Có");
    expect(getVal("BQ")).toBe("Không");
    expect(getVal("BR")).toBe("Trực tiếp");
    expect(getVal("AB")).toBe("Không");
    expect(getVal("AC")).toBe("Đồng bằng");
    expect(getVal("CE")).toBe("10 buổi/tuần");
  });
});
