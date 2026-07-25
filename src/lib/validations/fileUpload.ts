import { z } from "zod";

export const studentFileCategorySchema = z.enum([
  "PHOTO_4X6",
  "CCCD_FRONT",
  "CCCD_BACK",
]);

export const studentUploadMetadataSchema = z.object({
  category: studentFileCategorySchema,
});

export const MAX_STUDENT_UPLOAD_BYTES = 5 * 1024 * 1024;

const parsedQrDataSchema = z.object({
  cccd: z.string().max(32).optional(),
  oldId: z.string().max(32).optional(),
  fullName: z.string().max(256).optional(),
  dob: z.string().max(16).optional(),
  gender: z.string().max(32).optional(),
  address: z.string().max(1_000).optional(),
  issueDate: z.string().max(16).optional(),
});

export const cccdScanResultSchema = z.object({
  qr: z.object({
    rawPayload: z.string().max(5_000),
    parsed: parsedQrDataSchema,
    success: z.boolean(),
    decoder: z.object({
      name: z.string().min(1).max(64),
      version: z.string().min(1).max(32),
    }),
  }),
  ocr: z.object({
    rawText: z.string().max(50_000),
    engine: z.string().min(1).max(64),
  }),
});

export type StudentFileCategory = z.infer<typeof studentFileCategorySchema>;
