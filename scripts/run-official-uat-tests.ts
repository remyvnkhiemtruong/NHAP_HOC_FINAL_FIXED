import { spawnSync } from "node:child_process";
import path from "node:path";
import { withTestEnvironment } from "./test-environment";

withTestEnvironment((env) => {
  const result = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/run-official-uat.ts"],
    {
      cwd: path.resolve(__dirname, ".."),
      env,
      stdio: "inherit",
    },
  );
  if (result.status !== 0) process.exitCode = result.status ?? 1;
});
