import fs from "node:fs/promises";
import path from "node:path";
import {
  generateStudentPdf,
  type PdfStudentData,
} from "../src/lib/server/pdfExport";

const data: PdfStudentData = {
  student: {
    id: "smoke-student",
    current_cccd: "095311003768",
    current_dob: "03/02/2010",
    status: "APPROVED",
  },
  admission_record: {
    full_name_source: "Nguyễn Ngọc Minh Anh",
    cccd_source: "095311003768",
    dob_source: "03/02/2010",
    ethnicity_source: "Kinh",
    residence_source: "Xã Phước Long",
    middle_school_source: "THCS Phước Long",
    source_tt: "1",
  },
  profile_values: [],
  files: [],
  family_members: [],
  policy_records: [],
  disabilities: [],
};

async function main(): Promise<void> {
  const outputDirectory = path.resolve("output/pdf");
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(
    path.join(outputDirectory, "Thong_tin_hoc_sinh_095311003768.pdf"),
    await generateStudentPdf(data),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
