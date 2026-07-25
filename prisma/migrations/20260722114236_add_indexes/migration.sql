-- CreateIndex
CREATE INDEX "AdmissionRecord_cccd_source_idx" ON "AdmissionRecord"("cccd_source");

-- CreateIndex
CREATE INDEX "AdmissionRecord_full_name_source_idx" ON "AdmissionRecord"("full_name_source");

-- CreateIndex
CREATE INDEX "ExportJob_status_idx" ON "ExportJob"("status");

-- CreateIndex
CREATE INDEX "FileRecord_status_idx" ON "FileRecord"("status");

-- CreateIndex
CREATE INDEX "FileRecord_category_idx" ON "FileRecord"("category");

-- CreateIndex
CREATE INDEX "Student_status_idx" ON "Student"("status");

-- CreateIndex
CREATE INDEX "Student_current_cccd_current_dob_idx" ON "Student"("current_cccd", "current_dob");
