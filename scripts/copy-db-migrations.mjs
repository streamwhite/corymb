import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src", "db", "migrations");
const DEST = path.join(ROOT, "dist", "db", "migrations");
mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, { recursive: true });
