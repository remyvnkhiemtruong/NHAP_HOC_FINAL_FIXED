export const STUDENT_STATUSES = [
  "IMPORTED",
  "DRAFT",
  "SUBMITTED",
  "NEED_REVISION",
  "RESUBMITTED",
  "APPROVED",
  "LOCKED",
  "EXPORTED",
  "NEEDS_CCCD_CORRECTION",
] as const;

export type StudentStatus = (typeof STUDENT_STATUSES)[number];

const STATE_TRANSITIONS: Record<StudentStatus, readonly StudentStatus[]> = {
  IMPORTED: ["DRAFT", "SUBMITTED", "NEEDS_CCCD_CORRECTION"],
  DRAFT: ["SUBMITTED", "NEEDS_CCCD_CORRECTION"],
  SUBMITTED: ["NEED_REVISION", "APPROVED"],
  NEED_REVISION: ["RESUBMITTED"],
  RESUBMITTED: ["NEED_REVISION", "APPROVED"],
  APPROVED: ["LOCKED", "NEED_REVISION"],
  LOCKED: ["APPROVED", "EXPORTED"],
  EXPORTED: [],
  NEEDS_CCCD_CORRECTION: ["IMPORTED", "DRAFT"],
};

export const STUDENT_EDITABLE_STATUSES = new Set<StudentStatus>([
  "IMPORTED",
  "DRAFT",
  "NEED_REVISION",
]);

export const STUDENT_SUBMITTABLE_STATUSES = new Set<StudentStatus>([
  "IMPORTED",
  "DRAFT",
  "NEED_REVISION",
]);

export const ADMIN_REVIEWABLE_STATUSES = new Set<StudentStatus>([
  "SUBMITTED",
  "RESUBMITTED",
]);

export function isStudentStatus(value: string): value is StudentStatus {
  return STUDENT_STATUSES.includes(value as StudentStatus);
}

export function canTransition(currentStatus: string, newStatus: string): boolean {
  if (!isStudentStatus(currentStatus) || !isStudentStatus(newStatus)) return false;
  return currentStatus === newStatus || STATE_TRANSITIONS[currentStatus].includes(newStatus);
}

export function assertValidTransition(currentStatus: string, newStatus: string): void {
  if (!canTransition(currentStatus, newStatus)) {
    throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
  }
}

export function canStudentEdit(status: string): boolean {
  return isStudentStatus(status) && STUDENT_EDITABLE_STATUSES.has(status);
}

export function canStudentSubmit(status: string): boolean {
  return isStudentStatus(status) && STUDENT_SUBMITTABLE_STATUSES.has(status);
}

export function submittedStatusFor(status: string): "SUBMITTED" | "RESUBMITTED" {
  if (!canStudentSubmit(status)) {
    throw new Error(`Student profile cannot be submitted from ${status}`);
  }
  return status === "NEED_REVISION" ? "RESUBMITTED" : "SUBMITTED";
}
