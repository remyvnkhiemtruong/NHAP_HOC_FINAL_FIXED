import fs from "node:fs/promises";
import path from "node:path";

const target = path.join(
  process.cwd(),
  "node_modules",
  "brace-expansion",
  "dist",
  "commonjs",
  "index.js",
);
const marker = "/* vvk-commonjs-compat */";
const source = await fs.readFile(target, "utf8");

if (!source.includes(marker)) {
  await fs.writeFile(
    target,
    `${source}\n${marker}\nmodule.exports = expand;\nmodule.exports.expand = expand;\nmodule.exports.EXPANSION_MAX = 100_000;\nmodule.exports.EXPANSION_MAX_LENGTH = 4_000_000;\n`,
    "utf8",
  );
}
