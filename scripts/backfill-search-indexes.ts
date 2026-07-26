import { prisma } from "../src/lib/prisma";
import { backfillSearchIndexes } from "../src/lib/server/searchIndexBackfill";

backfillSearchIndexes()
  .then((result) => {
    console.info(
      `Search-index backfill complete: students=${result.studentsUpdated}, admissionRecords=${result.admissionRecordsUpdated}`,
    );
  })
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
