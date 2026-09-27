import { cpSync, mkdirSync } from "fs";
import path from "path";

const ROOT = path.join(import.meta.dir, "..");
const FOLDERS = ["migrations"];

for (const folder of FOLDERS) {
  const SRC = path.join(ROOT, "src", "db", folder);
  const DEST = path.join(ROOT, "dist", "db", folder);
  mkdirSync(DEST, { recursive: true });
  cpSync(SRC, DEST, { recursive: true });
}
