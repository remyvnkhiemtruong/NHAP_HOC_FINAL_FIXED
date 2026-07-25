/** @jest-environment node */

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueExportJob } from "@/services/queue/exportQueue";
import { POST } from "@/app/api/admin/exports/[type]/route";

jest.mock("@/lib/auth", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    student: { count: jest.fn() },
    exportJob: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock("@/services/queue/exportQueue", () => ({
  enqueueExportJob: jest.fn(),
}));
jest.mock("@/lib/server/exportService", () => ({
  EXPORTABLE_STATUSES: ["APPROVED", "LOCKED", "EXPORTED"],
}));

const getSessionMock = getSession as unknown as jest.Mock;
const studentCountMock = prisma.student.count as unknown as jest.Mock;
const transactionMock = prisma.$transaction as unknown as jest.Mock;
const exportJobFindUniqueMock = prisma.exportJob
  .findUnique as unknown as jest.Mock;
const auditCreateMock = prisma.auditLog.create as unknown as jest.Mock;
const enqueueExportJobMock = enqueueExportJob as unknown as jest.Mock;

const context = {
  params: Promise.resolve({ type: "school-excel" }),
} satisfies { params: Promise<{ type: string }> };
const photoContext = {
  params: Promise.resolve({ type: "photo-4x6-zip" }),
} satisfies { params: Promise<{ type: string }> };
const cccdContext = {
  params: Promise.resolve({ type: "cccd-zip" }),
} satisfies { params: Promise<{ type: string }> };
const request = (body: unknown) =>
  new Request("http://localhost/api/admin/exports/school-excel", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("POST /api/admin/exports/school-excel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auditCreateMock.mockResolvedValue({});
  });

  it("requires an ADMIN session", async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await POST(request({}), context)).status).toBe(401);
  });

  it("rejects invalid payloads before creating an export job", async () => {
    getSessionMock.mockResolvedValue({ userId: "admin-1" });
    expect((await POST(request({ unexpected: true }), context)).status).toBe(
      400,
    );
    expect(studentCountMock).not.toHaveBeenCalled();
  });

  it("reports a clear error when no eligible student exists", async () => {
    getSessionMock.mockResolvedValue({ userId: "admin-1" });
    studentCountMock.mockResolvedValue(0);
    const response = await POST(request({}), context);
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: expect.stringContaining("No approved"),
      }),
    );
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("blocks a photo ZIP request when no eligible student exists", async () => {
    getSessionMock.mockResolvedValue({ userId: "admin-1" });
    studentCountMock.mockResolvedValue(0);
    const response = await POST(request({}), photoContext);
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: expect.stringContaining("photo export"),
      }),
    );
  });

  it("blocks a CCCD ZIP request when no eligible student exists", async () => {
    getSessionMock.mockResolvedValue({ userId: "admin-1" });
    studentCountMock.mockResolvedValue(0);
    const response = await POST(request({}), cccdContext);
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: expect.stringContaining("CCCD export"),
      }),
    );
  });

  it("returns an existing pending job instead of creating a duplicate", async () => {
    getSessionMock.mockResolvedValue({ userId: "admin-1" });
    studentCountMock.mockResolvedValue(1);
    transactionMock.mockImplementation(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          exportJob: {
            findUnique: jest.fn().mockResolvedValue({
              id: "job-1",
              status: "PENDING",
              progress: 0,
            }),
          },
        }),
    );
    const response = await POST(request({}), context);
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      success: true,
      job: { id: "job-1", status: "PENDING", progress: 0 },
    });
    expect(enqueueExportJobMock).toHaveBeenCalledWith("job-1", "school-excel");
  });

  it("keeps a pending job recoverable and audits a queue outage", async () => {
    getSessionMock.mockResolvedValue({ userId: "admin-1" });
    studentCountMock.mockResolvedValue(1);
    transactionMock.mockImplementation(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          exportJob: {
            findUnique: jest.fn().mockResolvedValue({
              id: "job-1",
              status: "PENDING",
              progress: 0,
            }),
          },
        }),
    );
    enqueueExportJobMock.mockRejectedValue(new Error("Redis unavailable"));

    const response = await POST(request({}), context);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: "Export job is pending queue recovery",
        job: { id: "job-1", status: "PENDING", progress: 0 },
      }),
    );
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "EXPORT_QUEUE_ENQUEUE_FAILED",
        }),
      }),
    );
  });

  it("returns the concurrently-created active job after a dedupe conflict", async () => {
    getSessionMock.mockResolvedValue({ userId: "admin-1" });
    studentCountMock.mockResolvedValue(1);
    transactionMock.mockRejectedValue({ code: "P2002" });
    exportJobFindUniqueMock.mockResolvedValue({
      id: "job-1",
      status: "PROCESSING",
      progress: 20,
    });

    const response = await POST(request({}), context);
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      success: true,
      job: { id: "job-1", status: "PROCESSING", progress: 20 },
    });
    expect(enqueueExportJobMock).not.toHaveBeenCalled();
  });
});
