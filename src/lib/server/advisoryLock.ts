import type { Prisma } from "@/generated/prisma/client";

/**
 * Acquires a transaction-scoped PostgreSQL advisory lock without returning
 * PostgreSQL's `void` type, which Prisma cannot deserialize.
 */
export async function acquireTransactionLock(
  transaction: Prisma.TransactionClient,
  key: string,
): Promise<void> {
  const result = await transaction.$queryRaw<Array<{ acquired: number }>>`
    SELECT 1::int AS acquired
    FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))
  `;
  if (result[0]?.acquired !== 1) {
    throw new Error("Unable to acquire transaction advisory lock");
  }
}
