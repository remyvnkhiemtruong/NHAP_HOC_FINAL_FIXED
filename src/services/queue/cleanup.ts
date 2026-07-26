import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { deleteExportFile, getExportFileSize } from "@/lib/server/fileStorage";

export async function cleanupExpiredData(
  now = new Date(),
  options: { dryRun?: boolean } = {},
) {
  const dryRun = options.dryRun ?? false;
  const sessionCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
  const scanCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
  const incomingCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000);
  const expiredExports = await prisma.exportJob.findMany({
    where: {
      expires_at: { lt: now },
      official_artifact: null,
      OR: [{ output_key: { not: null } }, { error_report_key: { not: null } }],
    },
    select: { id: true, output_key: true, error_report_key: true },
  });
  let deletedArtifacts = 0;
  let reclaimableBytes = 0;
  for (const job of expiredExports) {
    for (const key of [job.output_key, job.error_report_key]) {
      if (!key) continue;
      reclaimableBytes += await getExportFileSize(key).catch(() => 0);
      if (!dryRun) await deleteExportFile(key).catch(() => undefined);
      deletedArtifacts += 1;
    }
  }
  if (expiredExports.length && !dryRun) {
    await prisma.exportJob.updateMany({
      where: { id: { in: expiredExports.map((job) => job.id) } },
      data: { output_key: null, error_report_key: null },
    });
  }
  const [adminSessions, studentSessions, qrResults, ocrResults] = dryRun
    ? await prisma.$transaction([
      prisma.adminSession.count({
        where: {
          OR: [
            { expires_at: { lt: sessionCutoff } },
            { revoked_at: { not: null, lt: sessionCutoff } },
          ],
        },
      }),
      prisma.studentAccessSession.count({
        where: {
          OR: [
            { expires_at: { lt: sessionCutoff } },
            { revoked_at: { not: null, lt: sessionCutoff } },
          ],
        },
      }),
      prisma.qrScanResult.count({ where: { created_at: { lt: scanCutoff } } }),
      prisma.ocrResult.count({ where: { created_at: { lt: scanCutoff } } }),
    ])
    : await prisma.$transaction([
    prisma.adminSession.deleteMany({
      where: {
        OR: [
          { expires_at: { lt: sessionCutoff } },
          { revoked_at: { not: null, lt: sessionCutoff } },
        ],
      },
    }),
    prisma.studentAccessSession.deleteMany({
      where: {
        OR: [
          { expires_at: { lt: sessionCutoff } },
          { revoked_at: { not: null, lt: sessionCutoff } },
        ],
      },
    }),
    prisma.qrScanResult.deleteMany({ where: { created_at: { lt: scanCutoff } } }),
    prisma.ocrResult.deleteMany({ where: { created_at: { lt: scanCutoff } } }),
    ]);

  const storageRoot = path.resolve(process.env.STORAGE_ROOT ?? path.join(process.cwd(), "storage"));
  const incomingRoot = path.join(storageRoot, "incoming");
  let deletedIncoming = 0;
  const entries = await fs.readdir(incomingRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(incomingRoot, entry.name);
    const metadata = await fs.stat(filePath).catch(() => null);
    if (metadata && metadata.mtime < incomingCutoff) {
      reclaimableBytes += metadata.size;
      if (!dryRun) await fs.rm(filePath, { force: true });
      deletedIncoming += 1;
    }
  }
  const result = {
    dryRun,
    reclaimableBytes,
    deletedArtifacts,
    deletedIncoming,
    deletedAdminSessions: typeof adminSessions === "number" ? adminSessions : adminSessions.count,
    deletedStudentSessions: typeof studentSessions === "number" ? studentSessions : studentSessions.count,
    deletedQrResults: typeof qrResults === "number" ? qrResults : qrResults.count,
    deletedOcrResults: typeof ocrResults === "number" ? ocrResults : ocrResults.count,
  };
  if (!dryRun) await prisma.auditLog.create({
    data: {
      actor_type: "SYSTEM",
      action: "RETENTION_CLEANUP_COMPLETED",
      entity_type: "System",
      entity_id: "retention",
      after_json: result,
    },
  });
  return result;
}
