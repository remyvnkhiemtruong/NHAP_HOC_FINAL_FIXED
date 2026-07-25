ALTER TABLE "ExportJob"
  ADD COLUMN "subject_student_id" TEXT,
  ADD COLUMN "payload_json" JSONB,
  ADD COLUMN "active_dedupe_key" TEXT,
  ADD COLUMN "output_filename" TEXT,
  ADD COLUMN "output_checksum" TEXT;

CREATE UNIQUE INDEX "ExportJob_active_dedupe_key_key"
  ON "ExportJob"("active_dedupe_key");
