import sharp from "sharp";
import { isBlueColor } from "@/lib/photo/validator";

export type ImageInspection = {
  format: "jpeg" | "png";
  width: number;
  height: number;
  size: number;
  normalized: Buffer;
};

export type PhotoServerInspection = ImageInspection & {
  status: "AUTO_VALID" | "AUTO_WARNING" | "AUTO_INVALID";
  errors: string[];
  warnings: string[];
  metrics: Record<string, number | boolean>;
};

export async function inspectAndNormalizeImage(
  input: Buffer,
  allowedFormats: readonly ("jpeg" | "png")[] = ["jpeg", "png"],
): Promise<ImageInspection> {
  const image = sharp(input, { failOn: "error", limitInputPixels: 40_000_000 });
  const metadata = await image.metadata();
  const format = metadata.format;
  if ((format !== "jpeg" && format !== "png") || !allowedFormats.includes(format)) {
    throw new Error("UNSUPPORTED_IMAGE_FORMAT");
  }
  if (!metadata.width || !metadata.height) throw new Error("INVALID_IMAGE_DIMENSIONS");
  if (metadata.pages && metadata.pages > 1) throw new Error("ANIMATED_IMAGE_NOT_ALLOWED");
  const normalized =
    format === "jpeg"
      ? await image.rotate().jpeg({ quality: 92, mozjpeg: true }).toBuffer()
      : await image.rotate().png({ compressionLevel: 9 }).toBuffer();
  return {
    format,
    width: metadata.width,
    height: metadata.height,
    size: normalized.length,
    normalized,
  };
}

export async function inspectPhoto4x6(input: Buffer): Promise<PhotoServerInspection> {
  const base = await inspectAndNormalizeImage(input, ["jpeg"]);
  const errors: string[] = [];
  const warnings: string[] = [];
  const ratio = base.width / base.height;
  if (Math.abs(ratio - 2 / 3) > 0.035) errors.push("PHOTO_RATIO_NOT_2_3");
  if (base.width < 472 || base.height < 709) errors.push("PHOTO_RESOLUTION_TOO_LOW");
  else if (base.width < 600 || base.height < 900) warnings.push("PHOTO_RESOLUTION_BELOW_RECOMMENDED");

  const sampleWidth = Math.min(160, base.width);
  const sampleHeight = Math.max(1, Math.round((base.height / base.width) * sampleWidth));
  const { data, info } = await sharp(base.normalized)
    .resize(sampleWidth, sampleHeight, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let luminanceTotal = 0;
  let blueEdges = 0;
  let edgeSamples = 0;
  let totalSamples = 0;
  for (let y = 0; y < info.height; y += 2) {
    for (let x = 0; x < info.width; x += 2) {
      const offset = (y * info.width + x) * info.channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      luminanceTotal += 0.299 * r + 0.587 * g + 0.114 * b;
      totalSamples += 1;
      const isEdge = y < info.height * 0.2 || x < info.width * 0.12 || x > info.width * 0.88;
      if (isEdge) {
        edgeSamples += 1;
        if (isBlueColor(r, g, b)) blueEdges += 1;
      }
    }
  }
  const brightness = totalSamples ? luminanceTotal / totalSamples : 0;
  const blueEdgeRatio = edgeSamples ? blueEdges / edgeSamples : 0;
  if (brightness < 45) warnings.push("PHOTO_TOO_DARK");
  if (brightness > 235) warnings.push("PHOTO_TOO_BRIGHT");
  if (blueEdgeRatio < 0.45) warnings.push("PHOTO_BACKGROUND_NOT_BLUE_OR_UNEVEN");

  const status = errors.length
    ? "AUTO_INVALID"
    : warnings.length
      ? "AUTO_WARNING"
      : "AUTO_VALID";
  return {
    ...base,
    status,
    errors,
    warnings,
    metrics: {
      ratio: Number(ratio.toFixed(4)),
      brightness: Number(brightness.toFixed(2)),
      blueEdgeRatio: Number(blueEdgeRatio.toFixed(4)),
      width: base.width,
      height: base.height,
    },
  };
}
