import { Job, UnrecoverableError, Worker } from "bullmq";
import { Worker as ThreadWorker } from "node:worker_threads";
import { Prisma } from "@/generated/prisma/client";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import {
  deleteExportFile,
  deletePrivateFile,
  saveExportFile,
  savePrivateFile,
  validateMagicBytes,
  writeExportFile,
} from "@/lib/server/fileStorage";
import { acquireTransactionLock } from "@/lib/server/advisoryLock";
import {
  buildErrorReport,
  effectiveValue,
  exportCccd,
  exportFileNames,
  generateScanReportCsv,
  generatePdfForStudent,
  loadApprovedStudents,
  outputChecksum,
  preflightExport,
  preflightPdfZip,
  selectCurrentFiles,
  studentsWithoutPreflightIssues,
  writeBulkStudentPdfZip,
  writeImageZip,
  writeScanReportPdf,
  writeSchoolExcel,
} from "@/lib/server/exportService";
import { buildExportContentManifest } from "@/lib/server/exportManifest";
import { EXPORT_QUEUE_NAME, exportQueueConnection } from "./exportQueue";
import { getProcessingQueue, PROCESSING_QUEUE_NAME } from "./processingQueue";
import { validateXlsxArchive } from "@/lib/server/xlsxArchive";
import { upsertImportedData } from "@/services/import/upsertService";
import { logger } from "@/lib/logger";
import { parseScoreRules } from "@/lib/campaign";
import jsQR from "jsqr";
import sharp from "sharp";
import { parseCccdQr } from "@/lib/cccd/qrParser";
import { readPrivateFile } from "@/lib/server/fileStorage";
import { inspectAndNormalizeImage, inspectPhoto4x6 } from "@/lib/server/imageInspection";
import { cleanupExpiredData } from "./cleanup";
import type { ParseResult } from "@/services/import/excelParser";
import type { ScoreRules } from "@/lib/campaign";

type ExportQueueData = { exportJobId: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown export error";
}

function isFinalAttempt(job: Job<ExportQueueData>): boolean {
  const attempts =
    typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
  return job.attemptsMade + 1 >= attempts;
}

async function updateProgress(
  job: Job<ExportQueueData>,
  progress: number,
): Promise<void> {
  await prisma.exportJob.update({
    where: { id: job.data.exportJobId },
    data: { progress },
  });
  await job.updateProgress(progress);
}

async function failExportJob(
  exportJobId: string,
  type: string,
  attempt: number,
  error: unknown,
  errorReportKey?: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.exportJob.update({
      where: { id: exportJobId },
      data: {
        status: "FAILED",
        progress: 100,
        active_dedupe_key: null,
        ...(errorReportKey ? { error_report_key: errorReportKey } : {}),
      },
    }),
    prisma.auditLog.create({
      data: {
        actor_type: "SYSTEM",
        action: "EXPORT_FAILED",
        entity_type: "ExportJob",
        entity_id: exportJobId,
        after_json: {
          type,
          attempt,
          error: errorMessage(error),
          errorReportKey: errorReportKey ?? null,
        },
      },
    }),
  ]);
}

export async function processExportJob(
  job: Job<ExportQueueData>,
): Promise<{ success: true; outputKey: string }> {
  let errorReportKey: string | undefined;
  let outputKeyToClean: string | undefined;
  const exportJobId = job.data.exportJobId;
  const exportJob = await prisma.exportJob.findUnique({
    where: { id: exportJobId },
    include: { campaign: true },
  });
  if (!exportJob) throw new UnrecoverableError("Export job not found");
  if (exportJob.status === "COMPLETED")
    return { success: true, outputKey: exportJob.output_key ?? "" };
  if (exportJob.status === "FAILED")
    throw new UnrecoverableError("Export job has already failed");

  const attempt = job.attemptsMade + 1;
  await prisma.$transaction([
    prisma.exportJob.update({
      where: { id: exportJobId },
      data: { status: "PROCESSING", progress: 5 },
    }),
    prisma.auditLog.create({
      data: {
        actor_type: "SYSTEM",
        action: attempt === 1 ? "EXPORT_PROCESSING" : "EXPORT_RETRYING",
        entity_type: "ExportJob",
        entity_id: exportJobId,
        after_json: { type: exportJob.type, attempt },
      },
    }),
  ]);
  await job.updateProgress(5);
  try {
    const names = exportFileNames(exportJob.campaign.code);
    const pdfCampaign = {
      schoolName: exportJob.campaign.school_name,
      schoolYearStart: exportJob.campaign.school_year_start,
      schoolYearEnd: exportJob.campaign.school_year_end,
    };
    const payload =
      exportJob.payload_json && typeof exportJob.payload_json === "object" && !Array.isArray(exportJob.payload_json)
        ? (exportJob.payload_json as { cohortStudentIds?: unknown })
        : {};
    const cohortStudentIds = Array.isArray(payload.cohortStudentIds)
      ? payload.cohortStudentIds.filter((value): value is string => typeof value === "string")
      : undefined;
    const students = await loadApprovedStudents(
      exportJob.subject_student_id ?? undefined,
      exportJob.campaign_id,
      cohortStudentIds,
    );
    if (!exportJob.content_manifest || !exportJob.content_manifest_hash) {
      throw new UnrecoverableError(
        "Export job is missing a content manifest; create a new export job",
      );
    }
    const currentContent = buildExportContentManifest(
      exportJob.campaign_id,
      students,
    );
    if (currentContent.hash !== exportJob.content_manifest_hash) {
      throw new UnrecoverableError(
        "Export cohort changed after the job was created; create a new export job",
      );
    }
    if (exportJob.type === "STUDENT_PDF" && students.length !== 1)
      throw new UnrecoverableError("Student is not exportable");
    if (exportJob.type === "SCHOOL_EXCEL" && students.length === 0)
      throw new UnrecoverableError(
        "No approved, locked, or exported students are available for Excel export",
      );
    if (exportJob.type === "PHOTO_ZIP" && students.length === 0)
      throw new UnrecoverableError(
        "No approved, locked, or exported students are available for photo export",
      );
    if (exportJob.type === "CCCD_ZIP" && students.length === 0)
      throw new UnrecoverableError(
        "No approved, locked, or exported students are available for CCCD export",
      );
    if (exportJob.type === "BULK_STUDENT_PDF_ZIP" && students.length === 0)
      throw new UnrecoverableError("No approved, locked, or exported students are available for PDF export");

    await updateProgress(job, 20);
    let output: Buffer | undefined;
    let streamProducer:
      | ((destination: import("stream").Writable) => Promise<void>)
      | undefined;
    let filename: string;
    let warningCount = 0;
    if (exportJob.type === "STUDENT_PDF") {
      const student = students[0];
      output = await generatePdfForStudent(student, pdfCampaign);
      filename = `Thong_tin_hoc_sinh_${effectiveValue(student.profile_values, "BF") || student.current_cccd}.pdf`;
    } else if (exportJob.type === "SCHOOL_EXCEL") {
      streamProducer = (destination) =>
        writeSchoolExcel(students, destination, {
          admissionDate: exportJob.campaign.admission_date,
        });
      filename = names.SCHOOL_EXCEL;
    } else if (exportJob.type === "SCAN_REPORT_CSV") {
      output = generateScanReportCsv(students);
      filename = names.SCAN_REPORT_CSV;
    } else if (exportJob.type === "SCAN_REPORT_PDF") {
      streamProducer = (destination) =>
        writeScanReportPdf(students, destination);
      filename = names.SCAN_REPORT_PDF;
    } else if (exportJob.type === "BULK_STUDENT_PDF_ZIP") {
      const issues = preflightPdfZip(students);
      const validStudents = studentsWithoutPreflightIssues(students, issues);
      if (issues.length) {
        errorReportKey = await saveExportFile(exportJobId, "bao_cao_canh_bao_export.csv", buildErrorReport(issues));
        warningCount = issues.length;
      }
      if (!validStudents.length) throw new UnrecoverableError("No student has a complete valid file set for PDF export");
      streamProducer = (destination) =>
        writeBulkStudentPdfZip(validStudents, destination, pdfCampaign);
      filename = names.BULK_STUDENT_PDF_ZIP;
    } else {
      const imageType =
        exportJob.type === "PHOTO_ZIP" ? "PHOTO_ZIP" : "CCCD_ZIP";
      const records = students.map((student) => ({
        cccd: exportCccd(student.profile_values, student.current_cccd),
        fullName:
          effectiveValue(student.profile_values, "C") ||
          student.admission_record.full_name_source,
        files: selectCurrentFiles(student.files),
      }));
      const issues = preflightExport(records, imageType);
      const validStudents = studentsWithoutPreflightIssues(students, issues);
      if (issues.length) {
        errorReportKey = await saveExportFile(exportJobId, "bao_cao_canh_bao_export.csv", buildErrorReport(issues));
        warningCount = issues.length;
      }
      if (!validStudents.length) throw new UnrecoverableError("No student has valid files for export");
      streamProducer = (destination) =>
        writeImageZip(validStudents, imageType, destination);
      filename =
        imageType === "PHOTO_ZIP"
          ? names.PHOTO_ZIP
          : names.CCCD_ZIP;
    }

    await updateProgress(job, 85);
    let outputKey: string;
    let checksum: string;
    if (streamProducer) {
      const artifact = await writeExportFile(
        exportJobId,
        filename,
        streamProducer,
      );
      outputKey = artifact.storageKey;
      checksum = artifact.checksum;
    } else {
      if (!output) throw new UnrecoverableError("Export produced no output");
      outputKey = await saveExportFile(exportJobId, filename, output);
      checksum = outputChecksum(output);
    }
    outputKeyToClean = outputKey;
    await prisma.$transaction([
      prisma.exportJob.update({
        where: { id: exportJobId },
        data: {
          status: "COMPLETED",
          progress: 100,
          output_key: outputKey,
          output_filename: filename,
          output_checksum: checksum,
          ...(errorReportKey ? { error_report_key: errorReportKey } : {}),
          completed_at: new Date(),
          active_dedupe_key: null,
        },
      }),
      prisma.auditLog.create({
        data: {
          actor_type: "SYSTEM",
          action: "EXPORT_COMPLETED",
          entity_type: "ExportJob",
          entity_id: exportJobId,
          after_json: {
            type: exportJob.type,
            attempt,
            outputKey,
            filename,
            checksum,
            errorReportKey: errorReportKey ?? null,
            warningCount,
          },
        },
      }),
    ]);
    outputKeyToClean = undefined;
    await job.updateProgress(100);
    return { success: true, outputKey };
  } catch (error) {
    if (outputKeyToClean) {
      await deleteExportFile(outputKeyToClean).catch(() => undefined);
      outputKeyToClean = undefined;
    }
    const current = await prisma.exportJob.findUnique({
      where: { id: exportJobId },
    });
    if (current?.status === "FAILED") throw error;
    if (error instanceof UnrecoverableError || isFinalAttempt(job)) {
      await failExportJob(exportJobId, exportJob.type, attempt, error, errorReportKey);
      await job.updateProgress(100);
    }
    throw error;
  }
}

// Export Job Worker
export const exportWorker = new Worker(EXPORT_QUEUE_NAME, processExportJob, {
  connection: exportQueueConnection,
  concurrency: Number.parseInt(process.env.EXPORT_WORKER_CONCURRENCY ?? "1", 10),
});

exportWorker.on("completed", (job) => {
  logger.info("Export job completed", { jobId: job.id });
});

exportWorker.on("failed", (job, err) => {
  logger.error("Export job failed", { jobId: job?.id, error: err });
});

type ProcessingQueueData = { processingJobId: string };

async function parseInIsolatedThread(
  buffer: Buffer,
  filename: string,
  scoreRules: ScoreRules,
): Promise<ParseResult> {
  const parser = new ThreadWorker(new URL("../import/parserThread.ts", import.meta.url), {
    execArgv: ["--import", "tsx"],
    resourceLimits: {
      maxOldGenerationSizeMb: 256,
      maxYoungGenerationSizeMb: 64,
      stackSizeMb: 4,
    },
  });
  const timeout = setTimeout(() => void parser.terminate(), 60_000);
  timeout.unref();
  try {
    return await new Promise<ParseResult>((resolve, reject) => {
      parser.once("message", (message: { ok: boolean; result?: ParseResult; error?: string }) => {
        if (message.ok && message.result) resolve(message.result);
        else reject(new UnrecoverableError(message.error ?? "Import parser failed"));
      });
      parser.once("error", reject);
      parser.once("exit", (code) => {
        if (code !== 0) reject(new UnrecoverableError("Import parser timed out or exceeded its resource limit"));
      });
      parser.postMessage({
        bytes: new Uint8Array(buffer),
        filename,
        scoreRules,
      });
    });
  } finally {
    clearTimeout(timeout);
    await parser.terminate();
  }
}

export async function processProcessingJob(job: Job<ProcessingQueueData>): Promise<{ success: true }> {
  if (job.name === "cleanup") {
    const result = await cleanupExpiredData(new Date(), {
      dryRun: process.env.CLEANUP_DRY_RUN === "true",
    });
    logger.info("Retention cleanup completed", result);
    return { success: true };
  }
  const record = await prisma.processingJob.findUnique({ where: { id: job.data.processingJobId } });
  if (!record) throw new UnrecoverableError("Processing job not found");
  if (record.status === "COMPLETED") return { success: true };
  if (!["IMPORT_XLSX", "IMAGE_PROCESS", "QR_SCAN"].includes(record.type)) {
    throw new UnrecoverableError("Unsupported processing job");
  }
  await prisma.processingJob.update({
    where: { id: record.id },
    data: { status: "PROCESSING", started_at: new Date(), attempts: { increment: 1 }, progress: 5 },
  });
  try {
    if (record.type === "IMAGE_PROCESS") {
      if (!record.input_key || !record.subject_student_id) {
        throw new UnrecoverableError("Image processing input is missing");
      }
      const metadata = await fs.stat(record.input_key);
      if (metadata.size <= 0 || metadata.size > 5 * 1024 * 1024) {
        throw new UnrecoverableError("Image exceeds the 5 MB limit");
      }
      const input = await fs.readFile(record.input_key);
      if (validateMagicBytes(input) !== "JPEG") {
        throw new UnrecoverableError("Image must be a complete JPEG file");
      }
      const payload =
        record.payload_json && typeof record.payload_json === "object" && !Array.isArray(record.payload_json)
          ? (record.payload_json as { category?: unknown })
          : {};
      const category =
        typeof payload.category === "string" &&
        ["PHOTO_4X6", "CCCD_FRONT", "CCCD_BACK", "OTHER"].includes(payload.category)
          ? (payload.category as "PHOTO_4X6" | "CCCD_FRONT" | "CCCD_BACK" | "OTHER")
          : null;
      if (!category) throw new UnrecoverableError("Invalid image category");
      const photoInspection = category === "PHOTO_4X6" ? await inspectPhoto4x6(input) : null;
      const inspection = photoInspection ?? (await inspectAndNormalizeImage(input, ["jpeg"]));
      if (inspection.normalized.length > 5 * 1024 * 1024) {
        throw new UnrecoverableError("Normalized image exceeds the 5 MB limit");
      }
      const storageKey = await savePrivateFile(record.subject_student_id, inspection.normalized, "jpg");
      try {
        const fileRecord = await prisma.$transaction(async (tx) => {
          // Serialize version allocation for a student's file category across
          // multiple worker processes. The lock is released with this transaction.
          await acquireTransactionLock(tx, `${record.subject_student_id}:${category}`);
          const student = await tx.student.findUnique({
            where: { id: record.subject_student_id! },
            select: { status: true },
          });
          if (!student) throw new UnrecoverableError("Student not found");
          const latest = await tx.fileRecord.findFirst({
            where: { student_id: record.subject_student_id!, category },
            orderBy: { current_version: "desc" },
            select: { current_version: true },
          });
          const revisionItems = await tx.revisionItem.findMany({
            where: {
              resolved_at: null,
              file: {
                student_id: record.subject_student_id!,
                category,
              },
            },
            select: { id: true },
          });
          await tx.fileRecord.updateMany({
            where: { student_id: record.subject_student_id!, category, is_current: true },
            data: { is_current: false, superseded_at: new Date() },
          });
          const created = await tx.fileRecord.create({
            data: {
              student_id: record.subject_student_id!,
              category,
              storage_key: storageKey,
              original_name: record.input_filename ?? "upload.jpg",
              mime: "image/jpeg",
              size: inspection.normalized.length,
              checksum: record.input_checksum!,
              width: inspection.width,
              height: inspection.height,
              current_version: (latest?.current_version ?? 0) + 1,
              status: photoInspection?.status ?? "AUTO_VALID",
              is_current: true,
              processed_at: new Date(),
              created_by: record.subject_student_id!,
            },
          });
          if (revisionItems.length) {
            await tx.revisionItem.updateMany({
              where: { id: { in: revisionItems.map((item) => item.id) } },
              data: { resolved_at: new Date() },
            });
          }
          if (photoInspection) {
            await tx.photoScanResult.create({
              data: {
                file_id: created.id,
                valid: photoInspection.status === "AUTO_VALID",
                warning_codes: [...photoInspection.errors, ...photoInspection.warnings],
                metrics_json: photoInspection.metrics,
              },
            });
          }
          if (student.status === "IMPORTED") {
            await tx.student.update({ where: { id: record.subject_student_id! }, data: { status: "DRAFT" } });
          }
          await tx.processingJob.update({
            where: { id: record.id },
            data: {
              status: "COMPLETED",
              progress: 100,
              completed_at: new Date(),
              subject_file_id: created.id,
              result_json: {
                fileRecord: {
                  id: created.id,
                  category: created.category,
                  status: created.status,
                  currentVersion: created.current_version,
                  width: created.width,
                  height: created.height,
                },
              },
            },
          });
          await tx.auditLog.create({
            data: {
              actor_type: "STUDENT",
              actor_id: record.subject_student_id!,
              action: "FILE_UPLOADED",
              entity_type: "FileRecord",
              entity_id: created.id,
              after_json: {
                category,
                version: created.current_version,
                status: created.status,
                checksum: created.checksum,
                processingJobId: record.id,
              },
            },
          });
          return created;
        });
        await fs.rm(record.input_key, { force: true });
        logger.info("Image processing completed", { processingJobId: record.id, fileId: fileRecord.id });
        return { success: true };
      } catch (error) {
        await deletePrivateFile(storageKey).catch(() => undefined);
        throw error;
      }
    }

    if (record.type === "QR_SCAN") {
      if (!record.subject_file_id || !record.subject_student_id) {
        throw new UnrecoverableError("QR scan subject is missing");
      }
      const file = await prisma.fileRecord.findFirst({
        where: {
          id: record.subject_file_id,
          student_id: record.subject_student_id,
          is_current: true,
          category: { in: ["CCCD_FRONT", "CCCD_BACK"] },
        },
      });
      if (!file) throw new UnrecoverableError("Current CCCD file not found");
      const input = await readPrivateFile(file.storage_key);
      const { data, info } = await sharp(input, { limitInputPixels: 25_000_000 })
        .rotate()
        .resize({ width: 1600, height: 1200, fit: "inside", withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const code = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
        inversionAttempts: "attemptBoth",
      });
      const parsed = parseCccdQr(code?.data ?? "");
      const cardSide = file.category === "CCCD_FRONT" ? "FRONT" : "BACK";
      const result = await prisma.$transaction(async (tx) => {
        const qr = await tx.qrScanResult.upsert({
          where: {
            file_id_engine_file_version_file_checksum: {
              file_id: file.id,
              engine: "jsqr-1.4.0",
              file_version: file.current_version,
              file_checksum: file.checksum,
            },
          },
          update: {
            parsed_json: { data: parsed as unknown as Prisma.InputJsonValue, decoder: { name: "jsQR", version: "1.4.0" } },
            success: Boolean(code?.data),
          },
          create: {
            file_id: file.id,
            card_side: cardSide,
            engine: "jsqr-1.4.0",
            file_checksum: file.checksum,
            file_version: file.current_version,
            parsed_json: { data: parsed as unknown as Prisma.InputJsonValue, decoder: { name: "jsQR", version: "1.4.0" } },
            success: Boolean(code?.data),
          },
        });
        await tx.processingJob.update({
          where: { id: record.id },
          data: {
            status: "COMPLETED",
            progress: 100,
            completed_at: new Date(),
            result_json: { qrResultId: qr.id, success: qr.success },
          },
        });
        await tx.auditLog.create({
          data: {
            actor_type: "SYSTEM",
            action: "CCCD_SERVER_SCAN_COMPLETED",
            entity_type: "FileRecord",
            entity_id: file.id,
            after_json: { cardSide, qrSuccess: qr.success, processingJobId: record.id },
          },
        });
        return qr;
      });
      logger.info("QR scan persisted", { processingJobId: record.id, success: result.success });
      return { success: true };
    }

    if (!record.input_key || !record.campaign_id) {
      throw new UnrecoverableError("Import job input is missing");
    }
    const metadata = await fs.stat(record.input_key);
    if (metadata.size <= 0 || metadata.size > 20 * 1024 * 1024) {
      throw new UnrecoverableError("Import file exceeds the 20 MB limit");
    }
    const buffer = await fs.readFile(record.input_key);
    const archive = validateXlsxArchive(buffer);
    const campaign = await prisma.admissionCampaign.findUnique({ where: { id: record.campaign_id } });
    if (!campaign) throw new UnrecoverableError("Campaign not found");
    const parsed = await parseInIsolatedThread(
      buffer,
      record.input_filename ?? "import.xlsx",
      parseScoreRules(campaign.score_rules),
    );
    const payload =
      record.payload_json && typeof record.payload_json === "object" && !Array.isArray(record.payload_json)
        ? (record.payload_json as { adminUsername?: unknown })
        : {};
    const imported = await upsertImportedData(
      parsed,
      typeof payload.adminUsername === "string" ? payload.adminUsername : record.owner_id,
      record.campaign_id,
      { idempotent: true },
    );
    await prisma.$transaction([
      prisma.processingJob.update({
        where: { id: record.id },
        data: {
          status: "COMPLETED",
          progress: 100,
          active_dedupe_key: null,
          completed_at: new Date(),
          result_json: {
            batchId: imported.batchId,
            reusedBatch: imported.reusedBatch ?? false,
            totalRows: parsed.totalRows,
            validRows: parsed.validRows,
            warningRows: parsed.warningRows,
            errorRows: parsed.errorRows,
            archiveEntries: archive.entries,
          },
        },
      }),
      prisma.auditLog.create({
        data: {
          actor_type: "SYSTEM",
          action: "ADMISSION_FILE_IMPORTED",
          entity_type: "ImportBatch",
          entity_id: imported.batchId,
          after_json: { processingJobId: record.id, checksum: parsed.checksum },
        },
      }),
    ]);
    await fs.rm(record.input_key, { force: true });
    return { success: true };
  } catch (error) {
    const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    if (finalAttempt || error instanceof UnrecoverableError) {
      const conflictRows =
        typeof error === "object" &&
        error !== null &&
        "conflicts" in error &&
        Array.isArray(error.conflicts)
          ? error.conflicts.flatMap((item) =>
              typeof item === "object" &&
              item !== null &&
              "row" in item &&
              Number.isInteger(Number(item.row))
                ? [{ row: Number(item.row) }]
                : [],
            )
          : [];
      await prisma.processingJob.update({
        where: { id: record.id },
        data: {
          status: "FAILED",
          progress: 100,
          active_dedupe_key: null,
          completed_at: new Date(),
          error_code:
            typeof error === "object" && error !== null && "code" in error
              ? String(error.code)
              : "IMPORT_FAILED",
          error_message: error instanceof Error ? error.message.slice(0, 1000) : "Import failed",
          result_json: conflictRows.length ? { conflicts: conflictRows } : undefined,
        },
      });
      if (record.input_key) await fs.rm(record.input_key, { force: true }).catch(() => undefined);
    }
    throw error;
  }
}

export const processingWorker = new Worker(PROCESSING_QUEUE_NAME, processProcessingJob, {
  connection: exportQueueConnection,
  concurrency: Number.parseInt(process.env.PROCESSING_WORKER_CONCURRENCY ?? "1", 10),
});

processingWorker.on("completed", (job) => logger.info("Processing job completed", { jobId: job.id }));
processingWorker.on("failed", (job, error) => logger.error("Processing job failed", { jobId: job?.id, error }));

let closing = false;
async function shutdown(signal: string): Promise<void> {
  if (closing) return;
  closing = true;
  logger.info("Worker shutdown started", { signal });
  const timeout = setTimeout(() => {
    logger.error("Worker shutdown timed out", { signal });
    process.exitCode = 1;
  }, 25_000);
  timeout.unref();
  await Promise.allSettled([processingWorker.close(), exportWorker.close()]);
  await Promise.allSettled([exportQueueConnection.quit(), prisma.$disconnect()]);
  clearTimeout(timeout);
  logger.info("Worker shutdown completed", { signal });
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

void getProcessingQueue().upsertJobScheduler(
  "daily-retention-cleanup",
  { pattern: "0 3 * * *" },
  { name: "cleanup", data: { processingJobId: "scheduled-cleanup" } },
);
