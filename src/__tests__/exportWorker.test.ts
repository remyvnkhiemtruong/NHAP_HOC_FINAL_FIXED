/** @jest-environment node */

const mockUpdateProgress = jest.fn();

jest.mock("bullmq", () => {
  class UnrecoverableError extends Error {}
  return {
    UnrecoverableError,
    Worker: jest.fn(() => ({ on: jest.fn() })),
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
jest.mock("@/lib/server/fileStorage", () => ({ saveExportFile: jest.fn() }));
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
import {
  buildErrorReport,
  generateImageZip,
  generateSchoolExcel,
  loadApprovedStudents,
  outputChecksum,
  preflightExport,
  studentsWithoutPreflightIssues,
} from "@/lib/server/exportService";
import { processExportJob } from "@/services/queue/worker";

const findUniqueMock = prisma.exportJob.findUnique as unknown as jest.Mock;
const updateMock = prisma.exportJob.update as unknown as jest.Mock;
const auditCreateMock = prisma.auditLog.create as unknown as jest.Mock;
const transactionMock = prisma.$transaction as unknown as jest.Mock;
const saveExportFileMock = saveExportFile as unknown as jest.Mock;
const buildErrorReportMock = buildErrorReport as unknown as jest.Mock;
const generateImageZipMock = generateImageZip as unknown as jest.Mock;
const generateSchoolExcelMock = generateSchoolExcel as unknown as jest.Mock;
const loadApprovedStudentsMock = loadApprovedStudents as unknown as jest.Mock;
const outputChecksumMock = outputChecksum as unknown as jest.Mock;
const preflightExportMock = preflightExport as unknown as jest.Mock;
const studentsWithoutPreflightIssuesMock = studentsWithoutPreflightIssues as unknown as jest.Mock;

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
  });

  it("persists progress, completion audit, and checksum after saving output", async () => {
    findUniqueMock.mockResolvedValue(pendingExcelJob);
    loadApprovedStudentsMock.mockResolvedValue([{ id: "student-1" }]);
    generateSchoolExcelMock.mockResolvedValue(Buffer.from("xlsx"));
    saveExportFileMock.mockResolvedValue("private/job-1/export.xlsx");

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
    expect(saveExportFileMock.mock.invocationCallOrder[0]).toBeLessThan(
      outputChecksumMock.mock.invocationCallOrder[0],
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
    expect(generateImageZipMock).not.toHaveBeenCalled();
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
