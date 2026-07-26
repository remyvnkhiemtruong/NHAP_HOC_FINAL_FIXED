import { Queue } from "bullmq";
import { exportQueueConnection } from "./exportQueue";

export const PROCESSING_QUEUE_NAME = "processing-queue";
let processingQueue: Queue | undefined;

export function getProcessingQueue(): Queue {
  processingQueue ??= new Queue(PROCESSING_QUEUE_NAME, {
    connection: exportQueueConnection,
  });
  return processingQueue;
}

export async function enqueueProcessingJob(jobId: string, type: string): Promise<boolean> {
  const queue = getProcessingQueue();
  const existing = await queue.getJob(jobId);
  if (existing) return false;
  await queue.add(
    type,
    { processingJobId: jobId },
    {
      jobId,
      attempts: 2,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: 200,
      removeOnFail: 200,
    },
  );
  return true;
}
