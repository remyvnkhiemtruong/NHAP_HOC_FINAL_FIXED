-- Campaigns and configurable admission rules.
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');
CREATE TYPE "ProcessingJobType" AS ENUM ('IMPORT_XLSX', 'IMAGE_PROCESS', 'QR_SCAN', 'CLEANUP');
CREATE TYPE "ProcessingJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "RevisionTargetType" AS ENUM ('PROFILE_FIELD', 'FILE');
ALTER TYPE "FileStatus" ADD VALUE IF NOT EXISTS 'PROCESSING' BEFORE 'UPLOADED';

CREATE TABLE "AdmissionCampaign" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "school_year_start" INTEGER NOT NULL,
  "school_year_end" INTEGER NOT NULL,
  "admission_date" TIMESTAMP(3) NOT NULL,
  "school_name" TEXT NOT NULL,
  "school_code" TEXT NOT NULL,
  "template_version" TEXT NOT NULL,
  "score_rules" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdmissionCampaign_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdmissionCampaign_code_key" ON "AdmissionCampaign"("code");
CREATE INDEX "AdmissionCampaign_status_idx" ON "AdmissionCampaign"("status");
CREATE UNIQUE INDEX "AdmissionCampaign_single_active_key"
  ON "AdmissionCampaign" ((1)) WHERE "status" = 'ACTIVE';

INSERT INTO "AdmissionCampaign" (
  "id", "code", "name", "status", "school_year_start", "school_year_end",
  "admission_date", "school_name", "school_code", "template_version", "score_rules", "updated_at"
) VALUES (
  'campaign_2026_2027', '2026-2027', 'Tuyển sinh lớp 10 năm học 2026–2027',
  'ACTIVE', 2026, 2027, '2026-09-04T17:00:00.000Z',
  'Trường THPT Võ Văn Kiệt', 'VVK', 'SMAS-2026-2027-v1',
  '{"fourYearAverage":{"min":0,"max":40,"precision":2},"fourYearConduct":{"min":0,"max":40,"precision":2},"priorityScore":{"min":0,"max":2,"precision":2},"encouragementScore":{"min":0,"max":2,"precision":2}}',
  CURRENT_TIMESTAMP
);

-- Isolate imported and operational records by campaign.
ALTER TABLE "ImportBatch" ADD COLUMN "campaign_id" TEXT;
ALTER TABLE "Student" ADD COLUMN "campaign_id" TEXT;
ALTER TABLE "Student" ADD COLUMN "current_cccd_lookup" TEXT;
ALTER TABLE "ExportJob" ADD COLUMN "campaign_id" TEXT;
UPDATE "ImportBatch" SET "campaign_id" = 'campaign_2026_2027';
UPDATE "Student" SET "campaign_id" = 'campaign_2026_2027';
UPDATE "ExportJob" SET "campaign_id" = 'campaign_2026_2027';
ALTER TABLE "ImportBatch" ALTER COLUMN "campaign_id" SET NOT NULL;
ALTER TABLE "Student" ALTER COLUMN "campaign_id" SET NOT NULL;
ALTER TABLE "ExportJob" ALTER COLUMN "campaign_id" SET NOT NULL;

DROP INDEX IF EXISTS "ImportBatch_checksum_key";
DROP INDEX IF EXISTS "Student_current_cccd_key";
DROP INDEX IF EXISTS "Student_current_cccd_current_dob_idx";
DROP INDEX IF EXISTS "Student_status_idx";
CREATE UNIQUE INDEX "ImportBatch_campaign_id_checksum_key" ON "ImportBatch"("campaign_id", "checksum");
CREATE INDEX "ImportBatch_campaign_id_created_at_idx" ON "ImportBatch"("campaign_id", "created_at");
CREATE UNIQUE INDEX "Student_campaign_id_current_cccd_lookup_key"
  ON "Student"("campaign_id", "current_cccd_lookup");
CREATE INDEX "Student_campaign_id_status_idx" ON "Student"("campaign_id", "status");
CREATE INDEX "ExportJob_campaign_id_status_idx" ON "ExportJob"("campaign_id", "status");

ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "AdmissionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "AdmissionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "AdmissionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Searchable blind indexes; ciphertext remains in the source columns.
ALTER TABLE "AdmissionRecord"
  ADD COLUMN "cccd_source_lookup" TEXT,
  ADD COLUMN "full_name_search_tokens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "middle_school_lookup" TEXT,
  ADD COLUMN "middle_school_commune_lookup" TEXT,
  ADD COLUMN "ethnicity_lookup" TEXT;
DROP INDEX IF EXISTS "AdmissionRecord_cccd_source_idx";
DROP INDEX IF EXISTS "AdmissionRecord_full_name_source_idx";
CREATE INDEX "AdmissionRecord_cccd_source_lookup_idx" ON "AdmissionRecord"("cccd_source_lookup");
CREATE INDEX "AdmissionRecord_middle_school_lookup_idx" ON "AdmissionRecord"("middle_school_lookup");
CREATE INDEX "AdmissionRecord_middle_school_commune_lookup_idx" ON "AdmissionRecord"("middle_school_commune_lookup");
CREATE INDEX "AdmissionRecord_ethnicity_lookup_idx" ON "AdmissionRecord"("ethnicity_lookup");

-- Explicit current file invariant.
ALTER TABLE "FileRecord"
  ADD COLUMN "is_current" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "superseded_at" TIMESTAMP(3),
  ADD COLUMN "processed_at" TIMESTAMP(3);
WITH ranked AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "student_id", "category" ORDER BY "current_version" DESC, "id" DESC
  ) AS position
  FROM "FileRecord"
)
UPDATE "FileRecord" f
SET "is_current" = false, "superseded_at" = CURRENT_TIMESTAMP
FROM ranked r
WHERE f."id" = r."id" AND r.position > 1;
DROP INDEX IF EXISTS "FileRecord_category_idx";
CREATE INDEX "FileRecord_student_id_category_is_current_idx"
  ON "FileRecord"("student_id", "category", "is_current");
CREATE UNIQUE INDEX "FileRecord_one_current_per_category_key"
  ON "FileRecord"("student_id", "category") WHERE "is_current" = true;

-- QR results are minimal, encrypted by the application, and idempotent.
ALTER TABLE "QrScanResult"
  ADD COLUMN "engine" TEXT,
  ADD COLUMN "file_checksum" TEXT,
  ADD COLUMN "file_version" INTEGER;
UPDATE "QrScanResult" q
SET "engine" = 'legacy',
    "file_checksum" = f."checksum",
    "file_version" = f."current_version"
FROM "FileRecord" f WHERE f."id" = q."file_id";
ALTER TABLE "QrScanResult" ALTER COLUMN "engine" SET NOT NULL;
ALTER TABLE "QrScanResult" ALTER COLUMN "file_checksum" SET NOT NULL;
ALTER TABLE "QrScanResult" ALTER COLUMN "file_version" SET NOT NULL;
ALTER TABLE "QrScanResult" DROP COLUMN "raw_payload";
CREATE UNIQUE INDEX "QrScanResult_file_id_engine_file_version_file_checksum_key"
  ON "QrScanResult"("file_id", "engine", "file_version", "file_checksum");

ALTER TABLE "ExportJob"
  ADD COLUMN "cohort_hash" TEXT,
  ADD COLUMN "expires_at" TIMESTAMP(3);

CREATE TABLE "ProcessingJob" (
  "id" TEXT NOT NULL,
  "type" "ProcessingJobType" NOT NULL,
  "status" "ProcessingJobStatus" NOT NULL DEFAULT 'PENDING',
  "campaign_id" TEXT,
  "subject_student_id" TEXT,
  "subject_file_id" TEXT,
  "owner_type" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "input_key" TEXT,
  "input_filename" TEXT,
  "input_checksum" TEXT,
  "payload_json" JSONB,
  "result_json" JSONB,
  "error_code" TEXT,
  "error_message" TEXT,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "active_dedupe_key" TEXT,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProcessingJob_active_dedupe_key_key" ON "ProcessingJob"("active_dedupe_key");
CREATE INDEX "ProcessingJob_status_type_idx" ON "ProcessingJob"("status", "type");
CREATE INDEX "ProcessingJob_owner_type_owner_id_created_at_idx"
  ON "ProcessingJob"("owner_type", "owner_id", "created_at");
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "AdmissionCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_subject_student_id_fkey"
  FOREIGN KEY ("subject_student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_subject_file_id_fkey"
  FOREIGN KEY ("subject_file_id") REFERENCES "FileRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Immutable official exports.
CREATE TABLE "ExportBatch" (
  "id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "cohort_hash" TEXT NOT NULL,
  "snapshot_checksum" TEXT NOT NULL,
  "created_by" TEXT NOT NULL,
  "note" TEXT,
  "legal_hold" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportBatch_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ExportBatchArtifact" (
  "id" TEXT NOT NULL,
  "export_batch_id" TEXT NOT NULL,
  "export_job_id" TEXT NOT NULL,
  "output_checksum" TEXT NOT NULL,
  CONSTRAINT "ExportBatchArtifact_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ExportBatchStudent" (
  "id" TEXT NOT NULL,
  "export_batch_id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "snapshot_json" TEXT NOT NULL,
  "snapshot_checksum" TEXT NOT NULL,
  "exported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportBatchStudent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExportBatch_campaign_id_created_at_idx" ON "ExportBatch"("campaign_id", "created_at");
CREATE UNIQUE INDEX "ExportBatchArtifact_export_job_id_key" ON "ExportBatchArtifact"("export_job_id");
CREATE UNIQUE INDEX "ExportBatchStudent_export_batch_id_student_id_key"
  ON "ExportBatchStudent"("export_batch_id", "student_id");
CREATE INDEX "ExportBatchStudent_student_id_exported_at_idx"
  ON "ExportBatchStudent"("student_id", "exported_at");
ALTER TABLE "ExportBatch" ADD CONSTRAINT "ExportBatch_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "AdmissionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExportBatchArtifact" ADD CONSTRAINT "ExportBatchArtifact_export_batch_id_fkey"
  FOREIGN KEY ("export_batch_id") REFERENCES "ExportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExportBatchArtifact" ADD CONSTRAINT "ExportBatchArtifact_export_job_id_fkey"
  FOREIGN KEY ("export_job_id") REFERENCES "ExportJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExportBatchStudent" ADD CONSTRAINT "ExportBatchStudent_export_batch_id_fkey"
  FOREIGN KEY ("export_batch_id") REFERENCES "ExportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExportBatchStudent" ADD CONSTRAINT "ExportBatchStudent_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Structured revision requests and append-only decisions.
CREATE TABLE "RevisionRequest" (
  "id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "profile_version_id" TEXT,
  "requested_by" TEXT NOT NULL,
  "general_reason" TEXT,
  "due_at" TIMESTAMP(3),
  "read_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RevisionRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RevisionItem" (
  "id" TEXT NOT NULL,
  "revision_request_id" TEXT NOT NULL,
  "target_type" "RevisionTargetType" NOT NULL,
  "profile_value_id" TEXT,
  "file_id" TEXT,
  "reason" TEXT NOT NULL,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "RevisionItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RevisionItem_exactly_one_target_check"
    CHECK (
      ("target_type" = 'PROFILE_FIELD' AND "profile_value_id" IS NOT NULL AND "file_id" IS NULL)
      OR
      ("target_type" = 'FILE' AND "profile_value_id" IS NULL AND "file_id" IS NOT NULL)
    )
);
CREATE TABLE "ReviewDecision" (
  "id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "profile_value_id" TEXT,
  "file_id" TEXT,
  "decision" TEXT NOT NULL,
  "value_before" TEXT,
  "value_after" TEXT,
  "reason" TEXT,
  "decided_by" TEXT NOT NULL,
  "profile_version" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewDecision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RevisionRequest_student_id_closed_at_created_at_idx"
  ON "RevisionRequest"("student_id", "closed_at", "created_at");
CREATE INDEX "RevisionItem_revision_request_id_resolved_at_idx"
  ON "RevisionItem"("revision_request_id", "resolved_at");
CREATE INDEX "ReviewDecision_student_id_created_at_idx"
  ON "ReviewDecision"("student_id", "created_at");
ALTER TABLE "RevisionRequest" ADD CONSTRAINT "RevisionRequest_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevisionRequest" ADD CONSTRAINT "RevisionRequest_profile_version_id_fkey"
  FOREIGN KEY ("profile_version_id") REFERENCES "StudentProfileVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RevisionItem" ADD CONSTRAINT "RevisionItem_revision_request_id_fkey"
  FOREIGN KEY ("revision_request_id") REFERENCES "RevisionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevisionItem" ADD CONSTRAINT "RevisionItem_profile_value_id_fkey"
  FOREIGN KEY ("profile_value_id") REFERENCES "StudentProfileValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RevisionItem" ADD CONSTRAINT "RevisionItem_file_id_fkey"
  FOREIGN KEY ("file_id") REFERENCES "FileRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_profile_value_id_fkey"
  FOREIGN KEY ("profile_value_id") REFERENCES "StudentProfileValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_file_id_fkey"
  FOREIGN KEY ("file_id") REFERENCES "FileRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Official snapshots/artifacts and review decisions are append-only. Legal hold
-- is the only mutable official-batch flag.
CREATE FUNCTION "reject_immutable_row_change"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'immutable record';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ExportBatchArtifact_immutable"
  BEFORE UPDATE OR DELETE ON "ExportBatchArtifact"
  FOR EACH ROW EXECUTE FUNCTION "reject_immutable_row_change"();
CREATE TRIGGER "ExportBatchStudent_immutable"
  BEFORE UPDATE OR DELETE ON "ExportBatchStudent"
  FOR EACH ROW EXECUTE FUNCTION "reject_immutable_row_change"();
CREATE TRIGGER "ReviewDecision_append_only"
  BEFORE UPDATE OR DELETE ON "ReviewDecision"
  FOR EACH ROW EXECUTE FUNCTION "reject_immutable_row_change"();

CREATE FUNCTION "protect_export_batch_snapshot"() RETURNS trigger AS $$
BEGIN
  IF OLD."id" IS DISTINCT FROM NEW."id"
     OR OLD."campaign_id" IS DISTINCT FROM NEW."campaign_id"
     OR OLD."cohort_hash" IS DISTINCT FROM NEW."cohort_hash"
     OR OLD."snapshot_checksum" IS DISTINCT FROM NEW."snapshot_checksum"
     OR OLD."created_by" IS DISTINCT FROM NEW."created_by"
     OR OLD."note" IS DISTINCT FROM NEW."note"
     OR OLD."created_at" IS DISTINCT FROM NEW."created_at" THEN
    RAISE EXCEPTION 'official export batch snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ExportBatch_snapshot_immutable"
  BEFORE UPDATE ON "ExportBatch"
  FOR EACH ROW EXECUTE FUNCTION "protect_export_batch_snapshot"();

-- Unique indexes already serve equality lookups; remove redundant copies.
DROP INDEX IF EXISTS "AdminSession_token_hash_idx";
DROP INDEX IF EXISTS "StudentAccessSession_token_hash_idx";
