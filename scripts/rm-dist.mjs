import { rmSync } from "fs";
import path from "path";

const ROOT = path.join(import.meta.dir, "..");
const DIST = path.join(ROOT, "dist");
rmSync(DIST, { recursive: true, force: true });
