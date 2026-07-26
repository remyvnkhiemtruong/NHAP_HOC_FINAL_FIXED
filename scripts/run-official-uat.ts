import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { ensureDefaultCampaign } from "../src/lib/campaign";
import { prisma } from "../src/lib/prisma";
import { parseExcelBuffer } from "../src/services/import/excelParser";
import { upsertImportedData } from "../src/services/import/upsertService";

async function main(): Promise<void> {
  const workbookPath = path.resolve(
    "00_INPUTS",
    "01_DU_LIEU_CHINH_THUC_TRUNG_TUYEN.xlsx",
  );
  const parsed = await parseExcelBuffer(
    await fs.readFile(workbookPath),
    path.basename(workbookPath),
  );
  assert.equal(parsed.totalRows, 930);
  assert.equal(parsed.validRows, 930);
  assert.equal(parsed.warningRows, 4);
  assert.equal(parsed.errorRows, 0);
  assert.equal(
    parsed.rows.filter(
      (row) => row.female_mark_source?.toLocaleLowerCase("vi-VN") === "x",
    ).length,
    491,
  );
  assert.equal(
    parsed.rows.filter((row) => !row.female_mark_source).length,
    439,
  );

  const campaign = await ensureDefaultCampaign();
  const imported = await upsertImportedData(
    parsed,
    "official-uat",
    campaign.id,
  );
  assert.ok(imported.batchId);
  assert.equal(await prisma.admissionRecord.count(), 930);
  assert.equal(await prisma.student.count(), 930);
  assert.equal(
    await prisma.student.count({
      where: { status: "NEEDS_CCCD_CORRECTION" },
    }),
    1,
  );
  assert.equal(
    await prisma.student.count({
      where: { current_cccd: { not: null }, current_cccd_lookup: null },
    }),
    0,
  );
  assert.equal(
    await prisma.admissionRecord.count({
      where: { cccd_source_lookup: null },
    }),
    0,
  );

  const repeated = await upsertImportedData(
    parsed,
    "official-uat",
    campaign.id,
    { idempotent: true },
  );
  assert.equal(repeated.reusedBatch, true);
  assert.equal(await prisma.importBatch.count(), 1);
  console.info(
    "Official UAT passed: 930 records, 491 female, 439 male, 4 warnings, 0 errors.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
