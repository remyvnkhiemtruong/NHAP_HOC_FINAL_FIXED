-- Prevent duplicate imports and duplicate source rows under concurrent requests.
CREATE UNIQUE INDEX IF NOT EXISTS "ImportBatch_checksum_key" ON "ImportBatch"("checksum");
CREATE UNIQUE INDEX IF NOT EXISTS "AdmissionRecord_import_batch_id_source_row_number_key"
  ON "AdmissionRecord"("import_batch_id", "source_row_number");
