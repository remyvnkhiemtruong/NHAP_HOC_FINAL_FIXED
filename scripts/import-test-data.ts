import { prisma } from "../src/lib/prisma";
import { upsertImportedData } from "../src/services/import/upsertService";
import { createSyntheticAdmissionParseResult } from "./synthetic-admission-fixture";

async function main(): Promise<void> {
  const parsed = createSyntheticAdmissionParseResult();
  await upsertImportedData(parsed, "test-admin", { idempotent: true });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
