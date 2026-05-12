import path from "node:path";
import {
  DEFAULT_UPLOAD_DIR_RELATIVE,
  ENV_UPLOAD_DIR_KEY,
} from "@/constants/upload.js";

export type ResolveUploadRootInput = {
  cwd?: string;
  uploadDir?: string;
};

function normalizeDir(cwd: string, dir: string): string {
  return path.isAbsolute(dir) ? dir : path.resolve(cwd, dir);
}

export function resolveUploadRoot(input?: ResolveUploadRootInput): string {
  const cwd = input?.cwd ?? process.cwd();
  if (input?.uploadDir !== undefined && input.uploadDir !== "") {
    return normalizeDir(cwd, input.uploadDir);
  }
  const fromEnv = process.env[ENV_UPLOAD_DIR_KEY];
  if (fromEnv !== undefined && fromEnv !== "") {
    return normalizeDir(cwd, fromEnv);
  }
  return path.resolve(cwd, DEFAULT_UPLOAD_DIR_RELATIVE);
}
