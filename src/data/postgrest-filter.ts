import type { PostgrestFilterOperator } from "@/data/postgrest-types.js";

const QUOTE = '"';
const ESCAPED_QUOTE = '\\"';
const RESERVED_PATTERN = /[",.()\s]/;
const IN_OPERATOR = "in" as const;

/** Encodes a scalar for a PostgREST filter, quoting reserved characters. */
export function encodeScalar(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const text = String(value);
  if (!RESERVED_PATTERN.test(text)) {
    return text;
  }
  return `${QUOTE}${text.replaceAll(QUOTE, ESCAPED_QUOTE)}${QUOTE}`;
}

export function encodeFilter(
  operator: PostgrestFilterOperator,
  value: unknown,
): string {
  if (operator === IN_OPERATOR) {
    const list = Array.isArray(value) ? value : [value];
    return `${IN_OPERATOR}.(${list.map(encodeScalar).join(",")})`;
  }
  return `${operator}.${encodeScalar(value)}`;
}
