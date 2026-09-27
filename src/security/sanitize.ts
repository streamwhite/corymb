import path from "node:path";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const HTML_ESCAPE_PATTERN = /[&<>"']/g;
const TAG_PATTERN = /<\/?[^>]+>/g;
const CONTROL_CHARS_PATTERN = /[\u0000-\u001F\u007F]/g;

/** Escapes a string for safe insertion into HTML text/attributes (XSS defense). */
export function escapeHtml(input: string): string {
  return input.replace(HTML_ESCAPE_PATTERN, (char) => HTML_ESCAPES[char] ?? char);
}

/** Strips HTML tags and control characters from user input. */
export function stripHtml(input: string): string {
  return input.replace(TAG_PATTERN, "").replace(CONTROL_CHARS_PATTERN, "").trim();
}

/**
 * Recursively strips HTML from string fields of a value (objects/arrays).
 * Limits depth to avoid pathological structures.
 */
export function sanitizeStrings<T>(value: T, maxDepth = 6): T {
  return walk(value, 0, maxDepth) as T;
}

function walk(value: unknown, depth: number, maxDepth: number): unknown {
  if (typeof value === "string") {
    return stripHtml(value);
  }
  if (depth >= maxDepth || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => walk(item, depth + 1, maxDepth));
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = walk(item, depth + 1, maxDepth);
  }
  return out;
}

/**
 * Resolves `userPath` under `root` and rejects traversal escapes. Returns the
 * absolute path, or null when the result would leave the root.
 */
export function safeJoinPath(root: string, userPath: string): string | null {
  const normalizedRoot = path.resolve(root);
  const target = path.resolve(normalizedRoot, userPath);
  const relative = path.relative(normalizedRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return target;
}

/** True when a path contains traversal segments (`..`) or absolute prefixes. */
export function isPathTraversal(userPath: string): boolean {
  const decoded = safeDecode(userPath);
  return (
    decoded.includes("..") ||
    decoded.startsWith("/") ||
    decoded.startsWith("\\") ||
    /^[a-zA-Z]:/.test(decoded)
  );
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
