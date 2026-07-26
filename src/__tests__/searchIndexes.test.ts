/** @jest-environment node */

import {
  nameSearchTokens,
  normalizeVietnameseSearch,
} from "@/lib/searchIndexes";

describe("blind search indexes", () => {
  it("normalizes accents, casing and repeated whitespace consistently", () => {
    expect(normalizeVietnameseSearch("  NGUYỄN   Văn  ")).toBe("nguyen van");
    expect(nameSearchTokens("Nguyễn Văn")).toEqual(
      nameSearchTokens("  NGUYEN   VAN "),
    );
  });

  it("deduplicates repeated name tokens", () => {
    expect(nameSearchTokens("Nguyễn Nguyễn")).toHaveLength(1);
  });
});
