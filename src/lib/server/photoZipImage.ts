import sharp from 'sharp';

/**
 * Keeps the image content intact while applying the EXIF orientation and
 * encoding the export entry as a plain JPEG without input metadata.
 */
export async function normalizeImageToJpeg(input: Buffer): Promise<Buffer> {
  return sharp(input).rotate().jpeg().toBuffer();
}

export const normalizePhoto4x6ToJpeg = normalizeImageToJpeg;
