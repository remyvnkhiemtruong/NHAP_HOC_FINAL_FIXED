/** @jest-environment node */

jest.mock("ioredis", () => jest.fn(() => ({})));
jest.mock("bullmq", () => ({
  Queue: jest.fn(() => ({ getJob: jest.fn(), add: jest.fn() })),
}));

import { Queue } from "bullmq";
import {
  enqueueExportJob,
  EXPORT_QUEUE_NAME,
  getExportQueue,
} from "@/services/queue/exportQueue";

getExportQueue();
const queueInstance = (Queue as unknown as jest.Mock).mock.results[0].value as {
  getJob: jest.Mock;
  add: jest.Mock;
};

describe("export queue", () => {
  beforeEach(() => jest.clearAllMocks());

  it("uses the ExportJob id and retry policy when enqueueing", async () => {
    queueInstance.getJob.mockResolvedValue(null);
    queueInstance.add.mockResolvedValue({ id: "job-1" });

    await expect(enqueueExportJob("job-1", "school-excel")).resolves.toBe(true);
    expect(queueInstance.add).toHaveBeenCalledWith(
      "school-excel",
      { exportJobId: "job-1" },
      expect.objectContaining({
        jobId: "job-1",
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
      }),
    );
    expect(EXPORT_QUEUE_NAME).toBe("export-queue");
  });

  it("does not duplicate an existing BullMQ job", async () => {
    queueInstance.getJob.mockResolvedValue({ id: "job-1" });

    await expect(enqueueExportJob("job-1", "school-excel")).resolves.toBe(
      false,
    );
    expect(queueInstance.add).not.toHaveBeenCalled();
  });
});
