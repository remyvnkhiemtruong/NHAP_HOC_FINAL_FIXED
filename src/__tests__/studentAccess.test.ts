import {
  normalizeStudentAccessDob,
  parseStudentAccessPayload,
} from "@/lib/validations/studentAccess";

describe("student access date of birth", () => {
  it.each([
    ["27012008", "27/01/2008"],
    ["29022024", "29/02/2024"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeStudentAccessDob(input)).toBe(expected);
  });

  it.each(["27012008x", "2701208", "29022023", "32122008"])(
    "rejects invalid input %s",
    (input) => {
      expect(normalizeStudentAccessDob(input)).toBeNull();
    },
  );

  it("requires a 12-digit CCCD and an eight-digit date", () => {
    expect(
      parseStudentAccessPayload({ cccd: "095311003768", dob: "27012008" }),
    ).toEqual({ cccd: "095311003768", dob: "27/01/2008" });
    expect(
      parseStudentAccessPayload({ cccd: "09531100376", dob: "27012008" }),
    ).toBeNull();
  });
});
