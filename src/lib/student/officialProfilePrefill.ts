import { inferProvinceFromCccd } from "@/lib/student/cccdInference";
import { COMMUNES } from "@/lib/catalogs/administrative";

export interface OfficialProfileSource {
  cccd: string;
  fullName: string;
  dateOfBirth: string;
  femaleMark: string | null;
  ethnicity: string | null;
  residenceCommune: string | null;
}

export interface OfficialProfileField {
  fieldCode: string;
  value: string;
}

export function getOfficialProfilePrefill(
  source: OfficialProfileSource,
): OfficialProfileField[] {
  const normalizedResidence = source.residenceCommune
    ?.trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("vi-VN");
  const residenceProvinces = new Set(
    COMMUNES.filter(
      (commune) =>
        commune.name
          .trim()
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLocaleLowerCase("vi-VN") === normalizedResidence,
    ).map((commune) => commune.provinceName.replace(/^(Tỉnh|Tp|Thành phố)\s+/u, "")),
  );
  const residenceProvince = residenceProvinces.size === 1 ? [...residenceProvinces][0] : "";
  const fields: OfficialProfileField[] = [
    { fieldCode: "BF", value: source.cccd },
    { fieldCode: "C", value: source.fullName },
    { fieldCode: "F", value: source.dateOfBirth },
    {
      fieldCode: "G",
      value: source.femaleMark?.trim().toLowerCase() === "x" ? "Nữ" : "Nam",
    },
    { fieldCode: "W", value: source.ethnicity ?? "" },
    { fieldCode: "BY", value: source.ethnicity ?? "" },
    { fieldCode: "L", value: residenceProvince },
    { fieldCode: "N", value: source.residenceCommune ?? "" },
  ];

  const inferredProvince = inferProvinceFromCccd(source.cccd);
  if (inferredProvince) {
    fields.push({ fieldCode: "CG", value: inferredProvince });
  }

  return fields.filter((field) => field.value !== "");
}
