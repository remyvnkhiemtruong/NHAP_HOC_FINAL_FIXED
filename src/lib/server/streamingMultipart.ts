import crypto from "crypto";
import { createWriteStream } from "fs";
import fs from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import Busboy from "busboy";

export class MultipartStreamError extends Error {
  constructor(
    public readonly code: "INVALID_MULTIPART" | "FILE_REQUIRED" | "FILE_TOO_LARGE" | "TOO_MANY_FILES",
    message: string,
  ) {
    super(message);
  }
}

export type StreamedMultipartFile = {
  path: string;
  filename: string;
  mimeType: string;
  size: number;
  checksum: string;
};

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

export async function streamSingleMultipartFile(
  request: Request,
  maximumBytes: number,
): Promise<{ file: StreamedMultipartFile; fields: Record<string, string>; cleanup: () => Promise<void> }> {
  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("multipart/form-data") || !request.body) {
    throw new MultipartStreamError("INVALID_MULTIPART", "Yêu cầu multipart không hợp lệ.");
  }
  const storageRoot = configuredStorageRoot();
  const incomingRoot = path.join(storageRoot, "incoming");
  await fs.mkdir(incomingRoot, { recursive: true, mode: 0o700 });
  const temporaryPath = path.join(incomingRoot, `${crypto.randomUUID()}.upload`);
  const fields: Record<string, string> = {};
  let fileMetadata: Omit<StreamedMultipartFile, "path" | "size" | "checksum"> | undefined;
  let bytes = 0;
  let limited = false;
  const hash = crypto.createHash("sha256");
  let filePromise: Promise<void> | undefined;

  const parser = Busboy({
    headers: { "content-type": contentType },
    limits: { files: 1, fields: 10, fileSize: maximumBytes, fieldSize: 8 * 1024 },
  });
  parser.on("field", (name, value) => {
    fields[name] = value;
  });
  parser.on("file", (_name, stream, info) => {
    fileMetadata = {
      filename: path.basename(info.filename || "upload.bin").slice(0, 255),
      mimeType: info.mimeType,
    };
    stream.on("limit", () => {
      limited = true;
    });
    stream.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      hash.update(chunk);
    });
    filePromise = pipeline(stream, createWriteStream(temporaryPath, { flags: "wx", mode: 0o600 }));
  });
  let filesLimit = false;
  parser.on("filesLimit", () => {
    filesLimit = true;
  });

  try {
    await pipeline(
      Readable.fromWeb(request.body as unknown as import("stream/web").ReadableStream),
      parser,
    );
    if (filePromise) await filePromise;
    if (filesLimit) throw new MultipartStreamError("TOO_MANY_FILES", "Chỉ được tải một tệp.");
    if (limited || bytes > maximumBytes) {
      throw new MultipartStreamError("FILE_TOO_LARGE", "Tệp tải lên vượt quá giới hạn.");
    }
    if (!fileMetadata || bytes === 0) {
      throw new MultipartStreamError("FILE_REQUIRED", "Tệp tải lên là bắt buộc.");
    }
    return {
      file: {
        path: temporaryPath,
        ...fileMetadata,
        size: bytes,
        checksum: hash.digest("hex"),
      },
      fields,
      cleanup: () => fs.rm(temporaryPath, { force: true }),
    };
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}
