import { prisma } from "../src/lib/prisma";
import { upsertImportedData } from "../src/services/import/upsertService";
import { ensureDefaultCampaign } from "../src/lib/campaign";
import { createSyntheticAdmissionParseResult } from "./synthetic-admission-fixture";

async function main(): Promise<void> {
  const parsed = createSyntheticAdmissionParseResult();
  const campaign = await ensureDefaultCampaign();
  await upsertImportedData(parsed, "test-admin", campaign.id, { idempotent: true });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
