import { Job, UnrecoverableError, Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { deleteExportFile, saveExportFile } from "@/lib/server/fileStorage";
import {
  buildErrorReport,
  effectiveValue,
  exportCccd,
  EXPORT_FILE_NAMES,
  generateImageZip,
  generateBulkStudentPdfZip,
  generateScanReportCsv,
  generateScanReportPdf,
  generatePdfForStudent,
  generateSchoolExcel,
  loadApprovedStudents,
  outputChecksum,
  preflightExport,
  preflightPdfZip,
  selectCurrentFiles,
  studentsWithoutPreflightIssues,
} from "@/lib/server/exportService";
import { EXPORT_QUEUE_NAME, exportQueueConnection } from "./exportQueue";

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
    const students = await loadApprovedStudents(
      exportJob.subject_student_id ?? undefined,
    );
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
    let output: Buffer;
    let filename: string;
    let warningCount = 0;
    if (exportJob.type === "STUDENT_PDF") {
      const student = students[0];
      output = await generatePdfForStudent(student);
      filename = `Thong_tin_hoc_sinh_${effectiveValue(student.profile_values, "BF") || student.current_cccd}.pdf`;
    } else if (exportJob.type === "SCHOOL_EXCEL") {
      output = await generateSchoolExcel(students);
      filename = EXPORT_FILE_NAMES.SCHOOL_EXCEL;
    } else if (exportJob.type === "SCAN_REPORT_CSV") {
      output = generateScanReportCsv(students);
      filename = EXPORT_FILE_NAMES.SCAN_REPORT_CSV;
    } else if (exportJob.type === "SCAN_REPORT_PDF") {
      output = await generateScanReportPdf(students);
      filename = EXPORT_FILE_NAMES.SCAN_REPORT_PDF;
    } else if (exportJob.type === "BULK_STUDENT_PDF_ZIP") {
      const issues = preflightPdfZip(students);
      const validStudents = studentsWithoutPreflightIssues(students, issues);
      if (issues.length) {
        errorReportKey = await saveExportFile(exportJobId, "bao_cao_canh_bao_export.csv", buildErrorReport(issues));
        warningCount = issues.length;
      }
      if (!validStudents.length) throw new UnrecoverableError("No student has a complete valid file set for PDF export");
      output = await generateBulkStudentPdfZip(validStudents);
      filename = EXPORT_FILE_NAMES.BULK_STUDENT_PDF_ZIP;
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
      output = await generateImageZip(validStudents, imageType);
      filename =
        imageType === "PHOTO_ZIP"
          ? EXPORT_FILE_NAMES.PHOTO_ZIP
          : EXPORT_FILE_NAMES.CCCD_ZIP;
    }

    await updateProgress(job, 85);
    const outputKey = await saveExportFile(exportJobId, filename, output);
    outputKeyToClean = outputKey;
    const checksum = outputChecksum(output);
    const lockedStudentIds = students.filter((student) => student.status === "LOCKED").map((student) => student.id);
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
      ...(lockedStudentIds.length
        ? [prisma.student.updateMany({ where: { id: { in: lockedStudentIds }, status: "LOCKED" }, data: { status: "EXPORTED" } })]
        : []),
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
});

exportWorker.on("completed", (job) => {
  console.log(`Job ${job.id} has completed!`);
});

exportWorker.on("failed", (job, err) => {
  console.log(`Job ${job?.id} has failed with ${err.message}`);
});
