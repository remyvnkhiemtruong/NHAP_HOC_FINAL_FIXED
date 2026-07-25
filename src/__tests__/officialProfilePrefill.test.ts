import { getOfficialProfilePrefill } from "@/lib/student/officialProfilePrefill";

describe("getOfficialProfilePrefill", () => {
  it.each([
    ["X", "Nữ"],
    ["", "Nam"],
    [null, "Nam"],
  ])("maps official gender mark %p to %s", (femaleMark, expectedGender) => {
    const fields = getOfficialProfilePrefill({
      cccd: "095000000001",
      fullName: "NGUYỄN VĂN A",
      dateOfBirth: "01/01/2011",
      femaleMark,
      ethnicity: "Kinh",
      residenceCommune: "Xã Phước Long",
    });

    expect(fields).toContainEqual({ fieldCode: "G", value: expectedGender });
  });

  it("preserves official source values and omits absent optional values", () => {
    expect(
      getOfficialProfilePrefill({
        cccd: "0",
        fullName: "PHAN HOÀNG AN",
        dateOfBirth: "15/12/2011",
        femaleMark: null,
        ethnicity: null,
        residenceCommune: null,
      }),
    ).toEqual([
      { fieldCode: "BF", value: "0" },
      { fieldCode: "C", value: "PHAN HOÀNG AN" },
      { fieldCode: "F", value: "15/12/2011" },
      { fieldCode: "G", value: "Nam" },
    ]);
  });
});
