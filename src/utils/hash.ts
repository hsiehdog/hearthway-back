import crypto from "crypto";

// Stable stringify ensures consistent hashing regardless of key order.
const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(",")}}`;
};

export const computeInputHash = (value: unknown): string => {
  const serialized = stableStringify(value);
  return crypto.createHash("sha256").update(serialized).digest("hex");
};
