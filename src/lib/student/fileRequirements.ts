export type RequiredStudentFile = {
  category: string;
  status: string;
  currentVersion: number;
};

export const VALID_CURRENT_FILE_STATUSES = new Set(["AUTO_VALID", "ADMIN_APPROVED"]);

export const REQUIRED_STUDENT_FILE_CATEGORIES = [
  "CCCD_FRONT",
  "CCCD_BACK",
  "PHOTO_4X6",
] as const;

export type RequiredStudentFileCategory = (typeof REQUIRED_STUDENT_FILE_CATEGORIES)[number];

export function currentStudentFiles(files: readonly RequiredStudentFile[]): Map<string, RequiredStudentFile> {
  const current = new Map<string, RequiredStudentFile>();
  for (const file of files) {
    const existing = current.get(file.category);
    if (!existing || file.currentVersion > existing.currentVersion) current.set(file.category, file);
  }
  return current;
}

export function requiredFileIssues(files: readonly RequiredStudentFile[]): RequiredStudentFileCategory[] {
  const current = currentStudentFiles(files);
  return REQUIRED_STUDENT_FILE_CATEGORIES.filter((category) => {
    const file = current.get(category);
    return !file || !VALID_CURRENT_FILE_STATUSES.has(file.status);
  });
}
