-- Add explicit, auditable job kinds for the ADMIN bulk report actions.
ALTER TYPE "ExportJobType" ADD VALUE IF NOT EXISTS 'BULK_STUDENT_PDF_ZIP';
ALTER TYPE "ExportJobType" ADD VALUE IF NOT EXISTS 'SCAN_REPORT_CSV';
ALTER TYPE "ExportJobType" ADD VALUE IF NOT EXISTS 'SCAN_REPORT_PDF';

-- PostgreSQL enum values cannot be safely removed in a down migration. Rollback
-- keeps these unused values and reverts application code before deployment.
