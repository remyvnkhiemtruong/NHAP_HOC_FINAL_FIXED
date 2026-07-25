import {
  cccdScanResultSchema,
  MAX_STUDENT_UPLOAD_BYTES,
  studentUploadMetadataSchema,
} from "@/lib/validations/fileUpload";

describe("student upload metadata", () => {
  it.each(["PHOTO_4X6", "CCCD_FRONT", "CCCD_BACK"])(
    "accepts supported category %s",
    (category) => {
      expect(studentUploadMetadataSchema.safeParse({ category }).success).toBe(
        true,
      );
    },
  );

  it.each(["OTHER", "", "CCCD", undefined])(
    "rejects unsupported category %s",
    (category) => {
      expect(studentUploadMetadataSchema.safeParse({ category }).success).toBe(
        false,
      );
    },
  );

  it("keeps the documented five-megabyte upload limit", () => {
    expect(MAX_STUDENT_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
  });

  it.each([
    [true, "079210123456|OLD|NGUYEN VAN A|15/10/2010|Nam|Hà Nội|01/01/2025"],
    [false, ""],
  ])(
    "accepts persisted scan results when QR success is %s",
    (success, rawPayload) => {
      expect(
        cccdScanResultSchema.safeParse({
          qr: {
            success,
            rawPayload,
            parsed: { cccd: success ? "079210123456" : undefined },
            decoder: { name: "jsQR", version: "1.4.0" },
          },
          ocr: { rawText: "CCCD", engine: "tesseract.js@7" },
        }).success,
      ).toBe(true);
    },
  );

  it("rejects an unbounded or incomplete scan payload", () => {
    expect(
      cccdScanResultSchema.safeParse({ qr: { success: true }, ocr: {} })
        .success,
    ).toBe(false);
  });
});
