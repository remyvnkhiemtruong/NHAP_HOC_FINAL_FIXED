-- DropForeignKey
ALTER TABLE "Address" DROP CONSTRAINT "Address_student_id_fkey";

-- DropForeignKey
ALTER TABLE "AdminSession" DROP CONSTRAINT "AdminSession_admin_id_fkey";

-- DropForeignKey
ALTER TABLE "Disability" DROP CONSTRAINT "Disability_student_id_fkey";

-- DropForeignKey
ALTER TABLE "FamilyMember" DROP CONSTRAINT "FamilyMember_student_id_fkey";

-- DropForeignKey
ALTER TABLE "FileRecord" DROP CONSTRAINT "FileRecord_student_id_fkey";

-- DropForeignKey
ALTER TABLE "OcrResult" DROP CONSTRAINT "OcrResult_file_id_fkey";

-- DropForeignKey
ALTER TABLE "PhotoScanResult" DROP CONSTRAINT "PhotoScanResult_file_id_fkey";

-- DropForeignKey
ALTER TABLE "PolicyRecord" DROP CONSTRAINT "PolicyRecord_student_id_fkey";

-- DropForeignKey
ALTER TABLE "QrScanResult" DROP CONSTRAINT "QrScanResult_file_id_fkey";

-- DropForeignKey
ALTER TABLE "StudentAccessSession" DROP CONSTRAINT "StudentAccessSession_student_id_fkey";

-- DropForeignKey
ALTER TABLE "StudentProfileValue" DROP CONSTRAINT "StudentProfileValue_student_id_fkey";

-- DropForeignKey
ALTER TABLE "StudentProfileVersion" DROP CONSTRAINT "StudentProfileVersion_student_id_fkey";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "reason" TEXT,
ADD COLUMN     "request_id" TEXT;

-- AlterTable
ALTER TABLE "FileRecord" ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "decision_at" TIMESTAMP(3),
ADD COLUMN     "decision_by" TEXT,
ADD COLUMN     "quarantine" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Student" ALTER COLUMN "current_cccd" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Disability_student_id_key" ON "Disability"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "FileRecord_student_id_category_current_version_key" ON "FileRecord"("student_id", "category", "current_version");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyRecord_student_id_key" ON "PolicyRecord"("student_id");

-- AddForeignKey
ALTER TABLE "StudentProfileValue" ADD CONSTRAINT "StudentProfileValue_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfileVersion" ADD CONSTRAINT "StudentProfileVersion_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAccessSession" ADD CONSTRAINT "StudentAccessSession_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyRecord" ADD CONSTRAINT "PolicyRecord_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disability" ADD CONSTRAINT "Disability_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrScanResult" ADD CONSTRAINT "QrScanResult_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "FileRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrResult" ADD CONSTRAINT "OcrResult_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "FileRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoScanResult" ADD CONSTRAINT "PhotoScanResult_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "FileRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

