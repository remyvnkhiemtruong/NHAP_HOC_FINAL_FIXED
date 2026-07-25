import {
  daysInIssueMonth,
  isValidIssueDate,
  issueYears,
  joinIssueDate,
  splitIssueDate,
} from "@/lib/student/issueDate";

describe("CCCD issue date controls", () => {
  it("round-trips the three selected parts", () => {
    expect(splitIssueDate("29/02/2024")).toEqual({
      year: "2024",
      month: "02",
      day: "29",
    });
    expect(
      joinIssueDate({ year: "2024", month: "02", day: "29" }),
    ).toBe("29/02/2024");
  });

  it.each([
    ["2024", "02", 29],
    ["2023", "02", 28],
    ["2026", "04", 30],
    ["2026", "01", 31],
  ])("returns valid days for %s-%s", (year, month, expected) => {
    expect(daysInIssueMonth(year, month)).toHaveLength(expected);
  });

  it("limits years to the birth year through the current year", () => {
    expect(issueYears("27/01/2008", new Date(2026, 6, 23))).toEqual(
      Array.from({ length: 19 }, (_, index) => 2026 - index),
    );
  });

  it.each([
    ["26/01/2008", false],
    ["27/01/2008", true],
    ["23/07/2026", true],
    ["24/07/2026", false],
  ])("validates issue date %s against birth date and today", (value, valid) => {
    expect(
      isValidIssueDate(value, "27/01/2008", new Date(2026, 6, 23, 12)),
    ).toBe(valid);
  });
});
