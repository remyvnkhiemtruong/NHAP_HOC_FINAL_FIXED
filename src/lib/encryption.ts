import crypto from "crypto";

const KEY_PATTERN = /^[0-9a-fA-F]{64}$/;
const TEST_KEY = "4f5a7e8d1c2b3a49687766554433221100112233445566778899aabbccddeeff";
let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const configuredKey = process.env.ENCRYPTION_KEY;
  const keyText = configuredKey ?? (process.env.NODE_ENV === "test" ? TEST_KEY : "");

  if (!KEY_PATTERN.test(keyText)) {
    throw new Error(
      "ENCRYPTION_KEY is required and must be a valid 64-character hex string (32 bytes)",
    );
  }

  cachedKey = Buffer.from(keyText, "hex");
  return cachedKey;
}

function encryptWithIv(text: string, iv: Buffer, mode: "det" | "rnd"): string {
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:v2:${mode}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Compatibility encryption for fields that are queried by equality. It is
 * deterministic by design; use only for those legacy columns and never for
 * general PII. New schemas should use encryptRandom plus a separate HMAC blind
 * index column.
 */
export function encryptDeterministic(text: string): string {
  if (!text || text.startsWith("enc:v")) return text;
  const iv = crypto
    .createHmac("sha256", getKey())
    .update(`det:v2:${text}`)
    .digest()
    .subarray(0, 12);
  return encryptWithIv(text, iv, "det");
}

export function encryptRandom(text: string): string {
  if (!text || text.startsWith("enc:v")) return text;
  return encryptWithIv(text, crypto.randomBytes(12), "rnd");
}

export function blindIndex(text: string, namespace = "default"): string {
  return crypto
    .createHmac("sha256", getKey())
    .update(`${namespace}:${text.trim()}`)
    .digest("hex");
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText || !encryptedText.startsWith("enc:v")) return encryptedText;
  const parts = encryptedText.split(":");
  if (parts.length !== 6) throw new Error("Invalid encrypted format");
  const [, version, mode, ivHex, authTagHex, dataHex] = parts;
  if (!new Set(["v1", "v2"]).has(version) || !new Set(["det", "rnd"]).has(mode)) {
    throw new Error("Unsupported encrypted format");
  }
  if (!/^[0-9a-f]+$/i.test(ivHex + authTagHex + dataHex)) {
    throw new Error("Encrypted payload contains invalid hexadecimal data");
  }
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(dataHex, "hex");
  if (![12, 16].includes(iv.length) || authTag.length !== 16) {
    throw new Error("Encrypted payload has invalid IV or authentication tag length");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
