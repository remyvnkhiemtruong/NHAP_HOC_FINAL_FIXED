const REDACTED_KEYS = /token|cookie|authorization|password|secret|cccd|dob|payload|raw|source_json/i;

function scrubString(value: string): string {
  return value
    .replace(/\b\d{12}\b/g, "[REDACTED_ID]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/enc:v\d+:[^\s,}\]]+/g, "[REDACTED_CIPHERTEXT]");
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[TRUNCATED]";
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message),
      stack:
        process.env.NODE_ENV === "production"
          ? undefined
          : value.stack
            ? scrubString(value.stack)
            : undefined,
    };
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  if (typeof value === "string") return scrubString(value);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      REDACTED_KEYS.test(key) ? "[REDACTED]" : redact(item, depth + 1),
    ]),
  );
}

function write(level: "info" | "warn" | "error", message: string, context?: Record<string, unknown>): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? (redact(context) as Record<string, unknown>) : {}),
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => write("error", message, context),
};
