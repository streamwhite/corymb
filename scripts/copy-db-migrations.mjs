import { cpSync, mkdirSync } from "fs";
import path from "path";

const ROOT = path.join(import.meta.dir, "..");
const SRC = path.join(ROOT, "src", "db", "migrations");
const DEST = path.join(ROOT, "dist", "db", "migrations");
mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, { recursive: true });
