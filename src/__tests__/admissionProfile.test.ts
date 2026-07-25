import {
  ADMISSION_FIELD_CODES,
  admissionEditableSchema,
  calculateAdmissionScore,
} from "@/lib/student/admissionProfile";

describe("official admission profile fields", () => {
  it("uses explicit namespaced codes without adding columns to A-CQ", () => {
    expect(Object.values(ADMISSION_FIELD_CODES)).toEqual([
      "ADMISSION_H",
      "ADMISSION_I",
      "ADMISSION_J",
      "ADMISSION_K",
      "ADMISSION_L",
      "ADMISSION_M",
      "ADMISSION_N",
      "ADMISSION_O",
    ]);
  });

  it("calculates the official total with blank bonus values as zero", () => {
    expect(
      calculateAdmissionScore({
        fourYearAverage: "38.8",
        fourYearConduct: "1.2",
        priorityScore: "",
        encouragementScore: "",
      }),
    ).toBe("40");
  });

  it.each(["-1", "NaN", "không hợp lệ"])(
    "rejects invalid numeric proposal %s",
    (fourYearAverage) => {
      expect(
        admissionEditableSchema.safeParse({ fourYearAverage }).success,
      ).toBe(false);
    },
  );

  it("rejects server-controlled admission score", () => {
    expect(
      admissionEditableSchema.safeParse({ admissionScore: "999" }).success,
    ).toBe(false);
  });
});
