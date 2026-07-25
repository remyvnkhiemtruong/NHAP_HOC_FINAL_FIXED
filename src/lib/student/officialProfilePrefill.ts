import { inferProvinceFromCccd } from "@/lib/student/cccdInference";

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
    { fieldCode: "L", value: "Cà Mau" },
    { fieldCode: "N", value: source.residenceCommune ?? "" },
  ];

  const inferredProvince = inferProvinceFromCccd(source.cccd);
  if (inferredProvince) {
    fields.push({ fieldCode: "CG", value: inferredProvince });
  }

  return fields.filter((field) => field.value !== "");
}
