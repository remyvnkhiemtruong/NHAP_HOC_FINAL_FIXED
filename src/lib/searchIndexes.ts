import { blindIndex } from "@/lib/encryption";

export function normalizeVietnameseSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("vi-VN")
    .trim()
    .replace(/\s+/g, " ");
}

export function nameSearchTokens(value: string): string[] {
  return [
    ...new Set(
      normalizeVietnameseSearch(value)
        .split(" ")
        .filter(Boolean)
        .map((token) => blindIndex(token, "admission_name_token:v1")),
    ),
  ];
}
