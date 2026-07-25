import { spawnSync } from "node:child_process";
import path from "node:path";

export const testDatabaseUrl =
  "postgresql://postgres:password@localhost:25432/vvk_test?schema=public";
export const testRedisUrl = "redis://localhost:26379";

function run(
  commandName: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): void {
  const result = spawnSync(commandName, args, {
    cwd: path.resolve(__dirname, ".."),
    env,
    stdio: "inherit",
  });
  if (result.status !== 0)
    throw new Error(`${commandName} ${args.join(" ")} failed`);
}

const testComposeArgs = [
  "compose",
  "--project-name",
  "vvk-tests",
  "-f",
  "docker-compose.test.yml",
];

export function withTestEnvironment(
  runTests: (env: NodeJS.ProcessEnv) => void,
): void {
  const env = {
    ...process.env,
    DATABASE_URL: testDatabaseUrl,
    REDIS_URL: testRedisUrl,
    TEST_DATABASE_URL: testDatabaseUrl,
    TEST_REDIS_URL: testRedisUrl,
    TEST_ADMIN_USERNAME: "test-admin",
    TEST_ADMIN_PASSWORD: "test-password-2026",
    JWT_SECRET: "super-secret-key-for-local-dev-only-vvk-2026-e2e-test",
    ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  };
  run("docker", [...testComposeArgs, "up", "-d", "--wait"], env);
  try {
    run(
      process.execPath,
      ["node_modules/prisma/build/index.js", "migrate", "deploy"],
      env,
    );
    run(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/seed-test-admin.ts"],
      env,
    );
    runTests(env);
  } finally {
    run("docker", [...testComposeArgs, "down", "-v", "--remove-orphans"], env);
  }
}
