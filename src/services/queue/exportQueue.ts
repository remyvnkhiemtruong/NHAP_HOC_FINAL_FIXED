import { Queue } from "bullmq";
import IORedis from "ioredis";

export const EXPORT_QUEUE_NAME = "export-queue";
const configuredRedisUrl = process.env.REDIS_URL;
if (process.env.NODE_ENV === "production" && !configuredRedisUrl) {
  throw new Error("Production requires REDIS_URL");
}
export const exportQueueConnection = new IORedis(
  configuredRedisUrl ?? "redis://localhost:6379",
  {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  },
);

let exportQueue: Queue | undefined;

export function getExportQueue(): Queue {
  exportQueue ??= new Queue(EXPORT_QUEUE_NAME, {
    connection: exportQueueConnection,
  });
  return exportQueue;
}

/**
 * Adds an ExportJob only when BullMQ does not already have the same job id.
 * The database keeps PENDING jobs after a Redis outage, so a later identical
 * request can safely call this again to recover the enqueue.
 */
export async function enqueueExportJob(
  jobId: string,
  type: string,
): Promise<boolean> {
  const queue = getExportQueue();
  const existing = await queue.getJob(jobId);
  if (existing) return false;

  await queue.add(
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
