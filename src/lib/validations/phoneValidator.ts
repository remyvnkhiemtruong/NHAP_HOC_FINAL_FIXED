import { PHONE_PREFIXES as PHONE_PREFIX_CATALOG } from "@/lib/catalogs/phone-prefixes";

export const PHONE_PREFIXES = PHONE_PREFIX_CATALOG.map((entry) => entry.prefix);

export function normalizePhone(phone: string): string {
  if (!phone) return "";
  let p = phone.replace(/[^0-9+]/g, "");
  if (p.startsWith("+84")) {
    p = "0" + p.slice(3);
  }
  return p;
}

export function isValidPhone(phone: string): boolean {
  const p = normalizePhone(phone);

  // Exactly 10 digits
  if (!/^\d{10}$/.test(p)) {
    return false;
  }

  // Block obvious spam numbers
  if (/^(\d)\1{9}$/.test(p)) return false; // 0000000000, 1111111111
  if (p === "0123456789" || p === "0987654321") return false;

  // Match prefixes
  for (const prefix of PHONE_PREFIXES) {
    if (p.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}
