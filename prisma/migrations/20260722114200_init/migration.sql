-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('IMPORTED', 'DRAFT', 'SUBMITTED', 'NEED_REVISION', 'RESUBMITTED', 'APPROVED', 'LOCKED', 'EXPORTED', 'NEEDS_CCCD_CORRECTION');

-- CreateEnum
CREATE TYPE "ChangeStatus" AS ENUM ('UNCHANGED', 'PROPOSED', 'ACCEPTED', 'REJECTED', 'ADMIN_EDITED');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('MISSING', 'UPLOADED', 'AUTO_VALID', 'AUTO_WARNING', 'AUTO_INVALID', 'ADMIN_APPROVED', 'ADMIN_REJECTED', 'REUPLOAD_REQUIRED');

-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('PHOTO_4X6', 'CCCD_FRONT', 'CCCD_BACK', 'OTHER');

-- CreateEnum
CREATE TYPE "FamilyMemberType" AS ENUM ('FATHER', 'MOTHER', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "ExportJobType" AS ENUM ('STUDENT_PDF', 'SCHOOL_EXCEL', 'PHOTO_ZIP', 'CCCD_ZIP');

-- CreateEnum
CREATE TYPE "ExportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "sheet_name" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL,
    "valid_rows" INTEGER NOT NULL,
    "warning_rows" INTEGER NOT NULL,
    "error_rows" INTEGER NOT NULL,
    "imported_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionRecord" (
    "id" TEXT NOT NULL,
    "import_batch_id" TEXT NOT NULL,
    "source_row_number" INTEGER NOT NULL,
    "source_tt" TEXT NOT NULL,
    "cccd_source" TEXT NOT NULL,
    "full_name_source" TEXT NOT NULL,
    "female_mark_source" TEXT,
    "dob_source" TEXT NOT NULL,
    "ethnicity_source" TEXT,
    "residence_source" TEXT,
    "middle_school_source" TEXT,
    "middle_school_commune_source" TEXT,
    "score_fields" JSONB,
    "note_source" TEXT,
    "source_json" JSONB NOT NULL,
    "data_quality_flags" JSONB,

    CONSTRAINT "AdmissionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "admission_record_id" TEXT NOT NULL,
    "current_cccd" TEXT NOT NULL,
    "current_dob" TEXT NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'IMPORTED',
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfileValue" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "field_code" TEXT NOT NULL,
    "source_value" TEXT,
    "proposed_value" TEXT,
    "approved_value" TEXT,
    "change_status" "ChangeStatus" NOT NULL DEFAULT 'UNCHANGED',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfileValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfileVersion" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),

    CONSTRAINT "StudentProfileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAccessSession" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentAccessSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "address_type" TEXT NOT NULL,
    "province_code" TEXT,
    "province_name_snapshot" TEXT,
    "commune_code" TEXT,
    "commune_name_snapshot" TEXT,
    "hamlet" TEXT,
    "detailed_text" TEXT,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "type" "FamilyMemberType" NOT NULL,
    "absent_or_deceased" BOOLEAN NOT NULL DEFAULT false,
    "full_name" TEXT,
    "birth_year" TEXT,
    "occupation" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "cccd" TEXT,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyRecord" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "has_policy" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "policy_regime" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PolicyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disability" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "has_disability" BOOLEAN NOT NULL DEFAULT false,
    "disability_type" TEXT,
    "not_assessed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Disability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileRecord" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "category" "FileCategory" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "status" "FileStatus" NOT NULL DEFAULT 'UPLOADED',

    CONSTRAINT "FileRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrScanResult" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "card_side" TEXT NOT NULL,
    "raw_payload" TEXT,
    "parsed_json" JSONB,
    "success" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrScanResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrResult" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "raw_text" TEXT,
    "parsed_json" JSONB,
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcrResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoScanResult" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "valid" BOOLEAN NOT NULL,
    "warning_codes" JSONB,
    "metrics_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoScanResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "type" "ExportJobType" NOT NULL,
    "status" "ExportJobStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "output_key" TEXT,
    "error_report_key" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Student_admission_record_id_key" ON "Student"("admission_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "Student_current_cccd_key" ON "Student"("current_cccd");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfileValue_student_id_field_code_key" ON "StudentProfileValue"("student_id", "field_code");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfileVersion_student_id_version_number_key" ON "StudentProfileVersion"("student_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "Address_student_id_address_type_key" ON "Address"("student_id", "address_type");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_student_id_type_key" ON "FamilyMember"("student_id", "type");

-- AddForeignKey
ALTER TABLE "AdmissionRecord" ADD CONSTRAINT "AdmissionRecord_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_admission_record_id_fkey" FOREIGN KEY ("admission_record_id") REFERENCES "AdmissionRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfileValue" ADD CONSTRAINT "StudentProfileValue_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfileVersion" ADD CONSTRAINT "StudentProfileVersion_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAccessSession" ADD CONSTRAINT "StudentAccessSession_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyRecord" ADD CONSTRAINT "PolicyRecord_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disability" ADD CONSTRAINT "Disability_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrScanResult" ADD CONSTRAINT "QrScanResult_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "FileRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrResult" ADD CONSTRAINT "OcrResult_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "FileRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoScanResult" ADD CONSTRAINT "PhotoScanResult_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "FileRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
