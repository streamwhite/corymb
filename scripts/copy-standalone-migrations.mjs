import { cpSync, mkdirSync } from "fs";
import path from "path";

const DIR_DB = "db";
const DIR_MIG = "migrations";

const ROOT = path.join(import.meta.dir, "..");
const SRC = path.join(ROOT, "src", "db", "migrations");
const DEST = path.join(ROOT, DIR_DB, DIR_MIG);

mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, { recursive: true });
