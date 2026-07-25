import {
  COMMUNES,
  findProvinceByName,
  getCommunesByProvinceName,
  PROVINCES,
} from "@/lib/catalogs/administrative";

describe("official administrative catalogue", () => {
  it("contains the 34 provinces and retains their official codes", () => {
    expect(PROVINCES).toHaveLength(34);
    expect(PROVINCES).toContainEqual({ code: "01", name: "Thành phố Hà Nội" });
    expect(PROVINCES).toContainEqual({ code: "96", name: "Cà Mau" });
  });

  it.each([
    ["Hà Nội", "01"],
    ["Thành phố Hà Nội", "01"],
    ["Cà Mau", "96"],
  ])("recognizes the source name %s as code %s", (name, code) => {
    expect(findProvinceByName(name)?.code).toBe(code);
  });

  it("keeps commune codes and scopes the list to the selected province", () => {
    expect(COMMUNES.length).toBeGreaterThan(3_000);
    const hanoiCommunes = getCommunesByProvinceName("Hà Nội");
    expect(hanoiCommunes).toContainEqual(
      expect.objectContaining({ code: "00070", name: "Phường Hoàn Kiếm", provinceCode: "01" }),
    );
    expect(hanoiCommunes.every((commune) => commune.provinceCode === "01")).toBe(true);
  });
});
