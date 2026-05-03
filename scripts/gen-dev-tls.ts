import { spawnSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import {
  DEV_TLS_CERT_FILENAME,
  DEV_TLS_KEY_FILENAME,
  DEV_TLS_OPENSSL_SUBJECT,
  DEV_TLS_SELF_SIGNED_DAYS,
  DEV_TLS_SUBDIR,
} from "../src/constants/tls-dev.js";

const OPENSSL_BIN = "openssl" as const;

const ROOT = path.join(import.meta.dir, "..");
const certDir = path.join(ROOT, DEV_TLS_SUBDIR);
const keyPath = path.join(certDir, DEV_TLS_KEY_FILENAME);
const certPath = path.join(certDir, DEV_TLS_CERT_FILENAME);

mkdirSync(certDir, { recursive: true });

if (existsSync(keyPath) && existsSync(certPath)) {
  console.info(`Dev TLS files already exist:\n  ${certPath}`);
  process.exit(0);
}

const args = [
  "req",
  "-x509",
  "-newkey",
  "rsa:2048",
  "-nodes",
  "-keyout",
  keyPath,
  "-out",
  certPath,
  "-days",
  DEV_TLS_SELF_SIGNED_DAYS,
  "-subj",
  DEV_TLS_OPENSSL_SUBJECT,
] as const;

const result = spawnSync(OPENSSL_BIN, [...args], { stdio: "inherit" });
process.exit(result.status === 0 ? 0 : 1);
