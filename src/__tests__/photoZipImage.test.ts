import sharp from 'sharp';
import { normalizeImageToJpeg, normalizePhoto4x6ToJpeg } from '@/lib/server/photoZipImage';

describe('photo ZIP JPEG normalization', () => {
  it('converts PNG input to a metadata-free JPEG without resizing', async () => {
    const png = await sharp({ create: { width: 600, height: 900, channels: 3, background: { r: 0, g: 96, b: 180 } } }).png().toBuffer();
    const output = await normalizePhoto4x6ToJpeg(png);
    const metadata = await sharp(output).metadata();
    expect(output.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(600);
    expect(metadata.height).toBe(900);
    expect(metadata.exif).toBeUndefined();
  });

  it('applies EXIF orientation before encoding the JPEG', async () => {
    const rotatedJpeg = await sharp({ create: { width: 600, height: 900, channels: 3, background: { r: 0, g: 96, b: 180 } } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const output = await normalizePhoto4x6ToJpeg(rotatedJpeg);
    const metadata = await sharp(output).metadata();
    expect(metadata.width).toBe(900);
    expect(metadata.height).toBe(600);
    expect(metadata.orientation).toBeUndefined();
  });

  it('uses the same safe JPEG normalization for CCCD images', async () => {
    const png = await sharp({ create: { width: 1000, height: 630, channels: 3, background: { r: 220, g: 220, b: 220 } } }).png().toBuffer();
    const metadata = await sharp(await normalizeImageToJpeg(png)).metadata();
    expect(metadata).toMatchObject({ format: 'jpeg', width: 1000, height: 630 });
  });
});
