import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { withTestEnvironment } from "./test-environment";

withTestEnvironment((env) => {
  const result = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/import-test-data.ts"],
    {
      cwd: path.resolve(__dirname, ".."),
      env,
      stdio: "inherit",
    },
  );
  if (result.status !== 0) throw new Error("Unable to import E2E test data");
  const worker = spawn(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "src/services/queue/worker.ts"],
    {
      cwd: path.resolve(__dirname, ".."),
      env,
      stdio: "inherit",
    },
  );
  try {
    const playwright = spawnSync(
      process.execPath,
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        ...process.argv.slice(2),
      ],
      {
        cwd: path.resolve(__dirname, ".."),
        env,
        stdio: "inherit",
      },
    );
    if (playwright.status !== 0) process.exitCode = playwright.status ?? 1;
  } finally {
    worker.kill();
  }
});
