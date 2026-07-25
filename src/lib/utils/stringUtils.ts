export function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSingleLine(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

export function normalizeUppercaseName(name: string): string {
  return normalizeSingleLine(name).toLocaleUpperCase('vi-VN');
}

export function normalizeMultiline(value: string): string {
  return value
    .normalize('NFC')
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();
}

export function stripLocationCode(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s*\(\d+\)\s*$/, '').trim();
}
