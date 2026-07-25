import {
  CCCD_ISSUERS,
  deriveCccdIssuer,
  isStudentEditableField,
  parseVietnameseDate,
} from "@/lib/student/profileRules";
import { readPersistedFields } from "@/lib/student/profilePersistence";

describe("student profile rules", () => {
  it.each([
    ["30/06/2024", CCCD_ISSUERS.ADMINISTRATIVE_POLICE_DEPARTMENT],
    ["01/07/2024", CCCD_ISSUERS.MINISTRY_OF_PUBLIC_SECURITY],
    ["02/01/2026", CCCD_ISSUERS.MINISTRY_OF_PUBLIC_SECURITY],
    ["", ""],
    ["31/02/2024", ""],
  ])("derives issuer for %s", (issueDate, issuer) => {
    expect(deriveCccdIssuer(issueDate)).toBe(issuer);
  });

  it("parses valid Vietnamese dates only", () => {
    expect(parseVietnameseDate("29/02/2024")?.toISOString()).toContain(
      "2024-02-29",
    );
    expect(parseVietnameseDate("29/02/2025")).toBeNull();
  });

  it("permits a student CCCD proposal but blocks derived and hidden fields", () => {
    expect(isStudentEditableField("BF")).toBe(true);
    expect(isStudentEditableField("AG")).toBe(false);
    expect(isStudentEditableField("BH")).toBe(false);
    expect(isStudentEditableField("CE")).toBe(false);
    expect(isStudentEditableField("BS")).toBe(false);
  });

  it("persists only editable string fields", () => {
    expect(
      readPersistedFields({
        BF: "095311003768",
        AG: "should-not-save",
        BH: "should-not-save",
        CE: "should-not-save",
        has_policy: true,
      }),
    ).toEqual({ BF: "095311003768" });
  });
});
