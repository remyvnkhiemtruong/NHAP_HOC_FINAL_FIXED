import { parentPort } from "node:worker_threads";
import type { ScoreRules } from "@/lib/campaign";
import { parseExcelBuffer } from "./excelParser";

type ParserRequest = {
  bytes: Uint8Array;
  filename: string;
  scoreRules: ScoreRules;
};

if (!parentPort) throw new Error("Import parser must run in a worker thread");

parentPort.once("message", async (request: ParserRequest) => {
  try {
    const result = await parseExcelBuffer(
      Buffer.from(request.bytes),
      request.filename,
      request.scoreRules,
    );
    parentPort?.postMessage({ ok: true, result });
  } catch (error) {
    parentPort?.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Import parser failed",
    });
  }
});
