import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";
import { parseExcelBuffer } from "../src/services/import/excelParser";
import { upsertImportedData } from "../src/services/import/upsertService";
import { ensureDefaultCampaign } from "../src/lib/campaign";

async function main() {
  const filePath = path.join(process.cwd(), "00_INPUTS/02_MAU_XUAT_95_COT_SMAS_MOET.xlsx");
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }
  
  const buffer = fs.readFileSync(filePath);
  console.log("Parsing Excel file...");
  const parsed = await parseExcelBuffer(buffer, "02_MAU_XUAT_95_COT_SMAS_MOET.xlsx");
  
  console.log(`Parsed ${parsed.totalRows} rows, ${parsed.validRows} valid, ${parsed.warningRows} warnings, ${parsed.errorRows} errors.`);
  console.log("Importing to database...");
  
  const campaign = await ensureDefaultCampaign();
  const result = await upsertImportedData(parsed, "vvk_sysadmin", campaign.id, { idempotent: true });
  console.log("Import completed!", result);
}

main()
  .catch((error) => {
    console.error("Failed to import:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
