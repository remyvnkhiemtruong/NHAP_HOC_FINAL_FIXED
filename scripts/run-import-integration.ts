import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { upsertImportedData } from "../src/services/import/upsertService";
import { createSyntheticAdmissionParseResult } from "./synthetic-admission-fixture";

async function main(): Promise<void> {
  const parsed = createSyntheticAdmissionParseResult();
  const first = await upsertImportedData(parsed, "test-admin");
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
  const reused = await upsertImportedData(parsed, "test-admin", { idempotent: true });
  assert.equal(reused.reusedBatch, true);
  assert.equal(await prisma.importBatch.count(), 1);
  assert.equal(await prisma.admissionRecord.count(), 5);
  const preserved = await prisma.studentProfileValue.findUniqueOrThrow({
    where: { student_id_field_code: { student_id: firstStudent.id, field_code: "C" } },
  });
  assert.equal(preserved.proposed_value, "GIỮ GIÁ TRỊ ĐỀ XUẤT");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
