/** @jest-environment node */

const mockUpdateProgress = jest.fn();

jest.mock("bullmq", () => {
  class UnrecoverableError extends Error {}
  return {
    Queue: jest.fn(() => ({ upsertJobScheduler: jest.fn() })),
    UnrecoverableError,
    Worker: jest.fn(() => ({ on: jest.fn(), close: jest.fn() })),
  };
});
jest.mock("@/services/queue/exportQueue", () => ({
  EXPORT_QUEUE_NAME: "export-queue",
  exportQueueConnection: {},
}));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    exportJob: { findUnique: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock("@/lib/server/fileStorage", () => ({
  saveExportFile: jest.fn(),
  writeExportFile: jest.fn(),
}));
jest.mock("@/lib/server/exportManifest", () => ({
  buildExportContentManifest: jest.fn(() => ({
    manifest: { version: 1 },
    hash: "content-hash",
  })),
}));
jest.mock("@/lib/server/exportService", () => ({
  buildErrorReport: jest.fn(),
  effectiveValue: jest.fn(),
  exportCccd: jest.fn(),
  EXPORT_FILE_NAMES: {
    SCHOOL_EXCEL: "Thong_tin_hoc_sinh_toan_truong_2026_2027.xlsx",
    PHOTO_ZIP: "Anh_4x6_toan_truong_2026_2027.zip",
    CCCD_ZIP: "Anh_CCCD_toan_truong_2026_2027.zip",
  },
  generateImageZip: jest.fn(),
  writeImageZip: jest.fn(),
  writeBulkStudentPdfZip: jest.fn(),
  writeScanReportPdf: jest.fn(),
  writeSchoolExcel: jest.fn(),
  exportFileNames: jest.fn(() => ({
    SCHOOL_EXCEL: "Thong_tin_hoc_sinh_toan_truong_2026_2027.xlsx",
    PHOTO_ZIP: "Anh_4x6_toan_truong_2026_2027.zip",
    CCCD_ZIP: "Anh_CCCD_toan_truong_2026_2027.zip",
  })),
  generatePdfForStudent: jest.fn(),
  generateSchoolExcel: jest.fn(),
  loadApprovedStudents: jest.fn(),
  outputChecksum: jest.fn(),
  preflightExport: jest.fn(),
  selectCurrentFiles: jest.fn(),
  studentsWithoutPreflightIssues: jest.fn(),
}));

import { Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { saveExportFile } from "@/lib/server/fileStorage";
import { writeExportFile } from "@/lib/server/fileStorage";
import {
  buildErrorReport,
  writeImageZip,
  writeSchoolExcel,
  loadApprovedStudents,
  outputChecksum,
  preflightExport,
  studentsWithoutPreflightIssues,
} from "@/lib/server/exportService";
import { processExportJob } from "@/services/queue/worker";
import { buildExportContentManifest } from "@/lib/server/exportManifest";

const findUniqueMock = prisma.exportJob.findUnique as unknown as jest.Mock;
const updateMock = prisma.exportJob.update as unknown as jest.Mock;
const auditCreateMock = prisma.auditLog.create as unknown as jest.Mock;
const transactionMock = prisma.$transaction as unknown as jest.Mock;
const saveExportFileMock = saveExportFile as unknown as jest.Mock;
const writeExportFileMock = writeExportFile as unknown as jest.Mock;
const buildErrorReportMock = buildErrorReport as unknown as jest.Mock;
const writeImageZipMock = writeImageZip as unknown as jest.Mock;
const writeSchoolExcelMock = writeSchoolExcel as unknown as jest.Mock;
const loadApprovedStudentsMock = loadApprovedStudents as unknown as jest.Mock;
const outputChecksumMock = outputChecksum as unknown as jest.Mock;
const preflightExportMock = preflightExport as unknown as jest.Mock;
const studentsWithoutPreflightIssuesMock = studentsWithoutPreflightIssues as unknown as jest.Mock;
const buildExportContentManifestMock =
  buildExportContentManifest as unknown as jest.Mock;

const makeJob = (attemptsMade = 0) =>
  ({
    data: { exportJobId: "job-1" },
    attemptsMade,
    opts: { attempts: 3 },
    updateProgress: mockUpdateProgress,
  }) as unknown as Job<{ exportJobId: string }>;

const pendingExcelJob = {
  id: "job-1",
  type: "SCHOOL_EXCEL",
  status: "PENDING",
  subject_student_id: null,
  output_key: null,
  campaign_id: "campaign-1",
  payload_json: { cohortStudentIds: ["student-1"] },
  content_manifest: { version: 1 },
  content_manifest_hash: "content-hash",
  campaign: {
    code: "2026-2027",
    admission_date: new Date("2026-08-15"),
  },
};

describe("export worker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateMock.mockResolvedValue({});
    auditCreateMock.mockResolvedValue({});
    transactionMock.mockImplementation((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
    outputChecksumMock.mockReturnValue("sha256-checksum");
    buildExportContentManifestMock.mockReturnValue({
      manifest: { version: 1 },
      hash: "content-hash",
    });
  });

  it("persists progress, completion audit, and checksum after saving output", async () => {
    findUniqueMock.mockResolvedValue(pendingExcelJob);
    loadApprovedStudentsMock.mockResolvedValue([{ id: "student-1" }]);
    writeSchoolExcelMock.mockResolvedValue(undefined);
    writeExportFileMock.mockResolvedValue({
      storageKey: "private/job-1/export.xlsx",
      checksum: "sha256-checksum",
      size: 4,
    });

    await expect(processExportJob(makeJob())).resolves.toEqual({
      success: true,
      outputKey: "private/job-1/export.xlsx",
    });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ progress: 20 }),
      }),
    );
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ progress: 85 }),
      }),
    );
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          output_checksum: "sha256-checksum",
        }),
      }),
    );
    expect(mockUpdateProgress).toHaveBeenNthCalledWith(1, 5);
    expect(mockUpdateProgress).toHaveBeenNthCalledWith(2, 20);
    expect(mockUpdateProgress).toHaveBeenNthCalledWith(3, 85);
    expect(mockUpdateProgress).toHaveBeenNthCalledWith(4, 100);
    expect(writeExportFileMock).toHaveBeenCalledWith(
      "job-1",
      expect.stringContaining(".xlsx"),
      expect.any(Function),
    );
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "EXPORT_COMPLETED" }),
      }),
    );
  });

  it("keeps the active dedupe key during a transient retry", async () => {
    findUniqueMock.mockResolvedValue(pendingExcelJob);
    loadApprovedStudentsMock.mockRejectedValue(
      new Error("storage unavailable"),
    );

    await expect(processExportJob(makeJob(0))).rejects.toThrow(
      "storage unavailable",
    );
    expect(updateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
    expect(auditCreateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "EXPORT_FAILED" }),
      }),
    );
  });

  it("marks only the last transient attempt as failed and writes an audit log", async () => {
    findUniqueMock.mockResolvedValue(pendingExcelJob);
    loadApprovedStudentsMock.mockRejectedValue(
      new Error("storage unavailable"),
    );

    await expect(processExportJob(makeJob(2))).rejects.toThrow(
      "storage unavailable",
    );
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          active_dedupe_key: null,
        }),
      }),
    );
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "EXPORT_FAILED" }),
      }),
    );
  });

  it("rejects an export when cohort content changed after job creation", async () => {
    findUniqueMock.mockResolvedValue(pendingExcelJob);
    loadApprovedStudentsMock.mockResolvedValue([{ id: "student-1" }]);
    buildExportContentManifestMock.mockReturnValue({
      manifest: { version: 1 },
      hash: "changed-content-hash",
    });

    await expect(processExportJob(makeJob())).rejects.toThrow(
      "Export cohort changed after the job was created",
    );
    expect(writeExportFileMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          active_dedupe_key: null,
        }),
      }),
    );
  });

  it("fails ZIP preflight once with a CSV and no partial ZIP", async () => {
    const photoJob = { ...pendingExcelJob, type: "PHOTO_ZIP" };
    const student = {
      profile_values: [],
      current_cccd: "095311003768",
      admission_record: { full_name_source: "Nguyen Van A" },
      files: [],
    };
    findUniqueMock.mockResolvedValue(photoJob);
    loadApprovedStudentsMock.mockResolvedValue([student]);
    preflightExportMock.mockReturnValue([
      { cccd: "0", fullName: "Nguyen Van A", code: "CCCD_ZERO" },
    ]);
    studentsWithoutPreflightIssuesMock.mockReturnValue([]);
    buildErrorReportMock.mockReturnValue(Buffer.from("report"));
    saveExportFileMock.mockResolvedValue(
      "private/job-1/bao_cao_loi_export.csv",
    );

    await expect(processExportJob(makeJob())).rejects.toThrow(
      "No student has valid files for export",
    );
    expect(writeImageZipMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          error_report_key: "private/job-1/bao_cao_loi_export.csv",
        }),
      }),
    );
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "EXPORT_FAILED" }),
      }),
    );
  });
});
