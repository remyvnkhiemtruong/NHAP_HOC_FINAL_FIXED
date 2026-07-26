import fs from "node:fs";

const compose = fs.readFileSync("docker-compose.yml", "utf8");
const example = fs.readFileSync(".env.example", "utf8");
const setup = fs.readFileSync("scripts/setup-env.mjs", "utf8");

const failures = [];
if (!compose.includes('127.0.0.1:5433:5432')) failures.push("Compose must publish PostgreSQL on 5433.");
if (!example.includes("@localhost:5433/")) failures.push(".env.example DATABASE_URL must use port 5433.");
if (!setup.includes("@localhost:5433/")) failures.push("setup-env must generate DATABASE_URL with port 5433.");
if (!compose.includes("private_storage:/data/private")) failures.push("Web and worker must share private storage.");
if (!compose.includes("RATE_LIMIT_BACKEND: redis")) failures.push("Production must use the Redis limiter.");

if (failures.length) {
  throw new Error(`Compose configuration smoke test failed:\n- ${failures.join("\n- ")}`);
}

console.log("Compose configuration smoke test passed.");
