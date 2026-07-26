/** @jest-environment node */

import type IORedis from "ioredis";
import { ensureRedisConnected } from "@/lib/rateLimit";

describe("rate-limit Redis connection", () => {
  it("shares one cold-start connection across concurrent callers", async () => {
    let releaseConnection: (() => void) | undefined;
    const redis = {
      status: "wait",
      connect: jest.fn(() => {
        redis.status = "connect";
        return new Promise<void>((resolve) => {
          releaseConnection = () => {
            redis.status = "ready";
            resolve();
          };
        });
      }),
    };

    const first = ensureRedisConnected(redis as unknown as IORedis);
    const second = ensureRedisConnected(redis as unknown as IORedis);
    expect(redis.connect).toHaveBeenCalledTimes(1);
    releaseConnection?.();
    await expect(Promise.all([first, second])).resolves.toEqual([
      undefined,
      undefined,
    ]);
  });
});
