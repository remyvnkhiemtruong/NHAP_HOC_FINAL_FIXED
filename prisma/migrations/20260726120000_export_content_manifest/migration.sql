ALTER TABLE "ExportJob"
  ADD COLUMN "content_manifest" JSONB,
  ADD COLUMN "content_manifest_hash" TEXT;

CREATE INDEX "ExportJob_content_manifest_hash_idx"
  ON "ExportJob"("content_manifest_hash");
