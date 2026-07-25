import { Queue } from "bullmq";
import IORedis from "ioredis";

export const EXPORT_QUEUE_NAME = "export-queue";
export const exportQueueConnection = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  },
);

export const exportQueue = new Queue(EXPORT_QUEUE_NAME, {
  connection: exportQueueConnection,
});

/**
 * Adds an ExportJob only when BullMQ does not already have the same job id.
 * The database keeps PENDING jobs after a Redis outage, so a later identical
 * request can safely call this again to recover the enqueue.
 */
export async function enqueueExportJob(
  jobId: string,
  type: string,
): Promise<boolean> {
  const existing = await exportQueue.getJob(jobId);
  if (existing) return false;

  await exportQueue.add(
    type,
    { exportJobId: jobId },
    {
      jobId,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  );
  return true;
}
