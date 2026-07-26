import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { upsertImportedData } from "../src/services/import/upsertService";
import { ensureDefaultCampaign } from "../src/lib/campaign";
import { createSyntheticAdmissionParseResult } from "./synthetic-admission-fixture";
import { backfillSearchIndexes } from "../src/lib/server/searchIndexBackfill";
import { acquireTransactionLock } from "../src/lib/server/advisoryLock";

async function main(): Promise<void> {
  await prisma.$transaction((transaction) =>
    acquireTransactionLock(transaction, "integration-advisory-lock"),
  );
  const parsed = createSyntheticAdmissionParseResult();
  const campaign = await ensureDefaultCampaign();
  const first = await upsertImportedData(parsed, "test-admin", campaign.id);
  assert.ok(first.batchId);
  assert.equal(await prisma.admissionRecord.count(), 5);
  assert.equal(await prisma.student.count(), 5);
  assert.equal(await prisma.student.count({ where: { status: "NEEDS_CCCD_CORRECTION" } }), 1);
  const missingCccd = await prisma.student.findFirstOrThrow({ where: { status: "NEEDS_CCCD_CORRECTION" } });
  assert.equal(missingCccd.current_cccd, null);

  const firstStudent = await prisma.student.findFirstOrThrow({
    where: { admission_record: { source_tt: "1" } },
    include: { admission_record: true },
  });
  await prisma.studentProfileValue.update({
    where: { student_id_field_code: { student_id: firstStudent.id, field_code: "C" } },
    data: { proposed_value: "GIỮ GIÁ TRỊ ĐỀ XUẤT", change_status: "PROPOSED" },
  });
  const reused = await upsertImportedData(parsed, "test-admin", campaign.id, { idempotent: true });
  assert.equal(reused.reusedBatch, true);
  assert.equal(await prisma.importBatch.count(), 1);
  assert.equal(await prisma.admissionRecord.count(), 5);
  const preserved = await prisma.studentProfileValue.findUniqueOrThrow({
    where: { student_id_field_code: { student_id: firstStudent.id, field_code: "C" } },
  });
  assert.equal(preserved.proposed_value, "GIỮ GIÁ TRỊ ĐỀ XUẤT");

  await prisma.$executeRaw`
    UPDATE "Student"
    SET "current_cccd_lookup" = NULL
    WHERE "id" = ${firstStudent.id}
  `;
  await prisma.$executeRaw`
    UPDATE "AdmissionRecord"
    SET "cccd_source_lookup" = NULL,
        "full_name_search_tokens" = ARRAY[]::text[]
    WHERE "id" = ${firstStudent.admission_record_id}
  `;
  const backfilled = await backfillSearchIndexes();
  assert.equal(backfilled.studentsUpdated, 1);
  assert.equal(backfilled.admissionRecordsUpdated, 1);
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
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
