import { readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const ROOT = path.join(import.meta.dir, "..");
const TYPES_DIR = path.join(ROOT, "dist", "types");

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (entry.name.endsWith(".d.ts")) {
      files.push(full);
    }
  }
  return files;
}

/** Rewrite `@/x` specifier to the relative path (for the real build root). */
export function relativeSpecifier(spec: string, fromFile: string): string {
  return computeRelativeSpecifier(spec, fromFile, TYPES_DIR);
}

export function rewriteFileInDir(typesRoot: string, file: string): void {
  const src = readFileSync(file, "utf8");
  const out = src.replace(
    /(["'])(@\/[^"']+)\1/g,
    (match, quote: string, spec: string) => {
      const rel = computeRelativeSpecifier(spec, file, typesRoot);
      return `${quote}${rel}${quote}`;
    },
  );
  if (out !== src) {
    writeFileSync(file, out);
  }
}

function computeRelativeSpecifier(
  spec: string,
  fromFile: string,
  typesRoot: string,
): string {
  const target = path.join(typesRoot, spec.slice(2));
  const fromDir = path.dirname(fromFile);
  const rel = path.relative(fromDir, target);
  return rel.startsWith(".") ? rel : `./${rel}`;
}

/** Rewrite `@/*` import specifiers to relative paths in emitted declarations. */
export function rewriteTypesPaths(typesRoot: string): void {
  for (const file of walk(typesRoot)) {
    rewriteFileInDir(typesRoot, file);
  }
}

rewriteTypesPaths(TYPES_DIR);
