import { rm } from "node:fs/promises";
import path from "node:path";

const workspace = process.cwd();
const generatedTypeDirectories = [
  path.join(workspace, ".next", "types"),
  path.join(workspace, ".next", "dev", "types"),
  path.join(workspace, ".next-e2e", "types"),
  path.join(workspace, ".next-e2e", "dev", "types"),
];

await Promise.all(
  generatedTypeDirectories.map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ),
);
