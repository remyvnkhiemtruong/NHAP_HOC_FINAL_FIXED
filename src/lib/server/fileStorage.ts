import crypto from "crypto";
import fs from "fs/promises";
import { createReadStream, createWriteStream } from "fs";
import path from "path";
import { Readable, Transform, type Writable } from "stream";
import { pipeline } from "stream/promises";

function configuredStorageRoot(): string {
  const configured = process.env.STORAGE_ROOT?.trim();
  if (!configured || configured === "storage" || configured === "./storage") {
    return path.join(process.cwd(), "storage");
  }
  if (path.isAbsolute(configured)) return path.normalize(configured);
  return path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    configured,
  );
}

const STORAGE_ROOT = configuredStorageRoot();
const UPLOAD_DIR = path.join(STORAGE_ROOT, "uploads");
const EXPORT_DIR = path.join(STORAGE_ROOT, "exports");

function safeSegment(value: string, label: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function resolveInside(root: string, relativePath: string): string {
  const normalized = path.normalize(relativePath.replaceAll("\\", "/"));
  if (!normalized || normalized === "." || path.isAbsolute(normalized) || normalized.startsWith("..")) {
    throw new Error("Invalid storage key");
  }
  const resolved = path.resolve(root, normalized);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Storage path escapes configured root");
  }
  return resolved;
}

export const MAGIC_BYTES = {
  JPEG: [0xff, 0xd8, 0xff],
  PNG: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
} as const;

export async function ensureUploadDir(studentId: string): Promise<string> {
  const dir = resolveInside(UPLOAD_DIR, safeSegment(studentId, "student id"));
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export function validateMagicBytes(buffer: Buffer): "JPEG" | "PNG" | null {
  if (buffer.length < 12) return null;
  if (MAGIC_BYTES.JPEG.every((byte, index) => buffer[index] === byte)) {
    return buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9 ? "JPEG" : null;
  }
  if (MAGIC_BYTES.PNG.every((byte, index) => buffer[index] === byte)) {
    const end = buffer.subarray(-12);
    return end.subarray(4, 8).toString("ascii") === "IEND" ? "PNG" : null;
  }
  return null;
}

export function calculateChecksum(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function savePrivateFile(
  studentId: string,
  buffer: Buffer,
  extension: string,
): Promise<string> {
  const safeExtension = extension.toLowerCase();
  if (!new Set(["jpg", "jpeg", "png"]).has(safeExtension)) throw new Error("Invalid extension");
  const dir = await ensureUploadDir(studentId);
  const filename = `${crypto.randomUUID()}.${safeExtension === "jpeg" ? "jpg" : safeExtension}`;
  const finalPath = resolveInside(dir, filename);
  const temporaryPath = `${finalPath}.tmp-${crypto.randomUUID()}`;
  await fs.writeFile(temporaryPath, buffer, { flag: "wx", mode: 0o600 });
  await fs.rename(temporaryPath, finalPath);
  return `${safeSegment(studentId, "student id")}/${filename}`;
}

export async function deletePrivateFile(storageKey: string): Promise<void> {
  const filePath = resolveInside(UPLOAD_DIR, storageKey);
  await fs.rm(filePath, { force: true });
}

export async function readPrivateFile(storageKey: string): Promise<Buffer> {
  return fs.readFile(resolveInside(UPLOAD_DIR, storageKey));
}

export async function saveExportFile(jobId: string, filename: string, buffer: Buffer): Promise<string> {
  const safeJobId = safeSegment(jobId, "job id");
  const safeFilename = path.basename(filename).replaceAll(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 180);
  if (!safeFilename) throw new Error("Invalid export filename");
  const dir = resolveInside(EXPORT_DIR, safeJobId);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const finalPath = resolveInside(dir, safeFilename);
  const temporaryPath = `${finalPath}.tmp-${crypto.randomUUID()}`;
  await fs.writeFile(temporaryPath, buffer, { flag: "wx", mode: 0o600 });
  await fs.rename(temporaryPath, finalPath);
  return `${safeJobId}/${safeFilename}`;
}

export async function writeExportFile(
  jobId: string,
  filename: string,
  producer: (destination: Writable) => Promise<void>,
): Promise<{ storageKey: string; checksum: string; size: number }> {
  const safeJobId = safeSegment(jobId, "job id");
  const safeFilename = path.basename(filename).replaceAll(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 180);
  if (!safeFilename) throw new Error("Invalid export filename");
  const dir = resolveInside(EXPORT_DIR, safeJobId);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const finalPath = resolveInside(dir, safeFilename);
  const temporaryPath = `${finalPath}.tmp-${crypto.randomUUID()}`;
  const hash = crypto.createHash("sha256");
  let size = 0;
  const checksumStream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      size += chunk.length;
      callback(null, chunk);
    },
  });
  const output = createWriteStream(temporaryPath, { flags: "wx", mode: 0o600 });
  const completed = pipeline(checksumStream, output);
  try {
    await producer(checksumStream);
    if (!checksumStream.writableEnded) checksumStream.end();
    await completed;
    await fs.rename(temporaryPath, finalPath);
    return {
      storageKey: `${safeJobId}/${safeFilename}`,
      checksum: hash.digest("hex"),
      size,
    };
  } catch (error) {
    checksumStream.destroy();
    output.destroy();
    await completed.catch(() => undefined);
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function deleteExportFile(storageKey: string): Promise<void> {
  await fs.rm(resolveInside(EXPORT_DIR, storageKey), { force: true });
}

export async function readExportFile(storageKey: string): Promise<Buffer> {
  return fs.readFile(resolveInside(EXPORT_DIR, storageKey));
}

export async function getExportFileSize(storageKey: string): Promise<number> {
  return (await fs.stat(resolveInside(EXPORT_DIR, storageKey))).size;
}

export async function streamExportFile(
  storageKey: string,
  range?: { start: number; end: number },
): Promise<{ stream: ReadableStream<Uint8Array>; size: number; totalSize: number }> {
  const filePath = resolveInside(EXPORT_DIR, storageKey);
  const metadata = await fs.stat(filePath);
  const start = range?.start ?? 0;
  const end = range?.end ?? metadata.size - 1;
  if (start < 0 || end < start || end >= metadata.size) throw new Error("INVALID_RANGE");
  const nodeStream = createReadStream(filePath, { start, end });
  return {
    stream: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
    size: end - start + 1,
    totalSize: metadata.size,
  };
}
