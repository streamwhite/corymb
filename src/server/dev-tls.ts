import { existsSync } from "fs";
import path from "path";
import {
  DEV_TLS_CERT_FILENAME,
  DEV_TLS_KEY_FILENAME,
  DEV_TLS_SUBDIR,
  ENV_NODE_ENV,
  ENV_TLS_CERT_PATH,
  ENV_TLS_KEY_PATH,
  NODE_ENV_DEVELOPMENT,
} from "@/constants/tls-dev.js";

export type DevTlsPaths = { key: string; cert: string };

function defaultDevTlsPaths(): DevTlsPaths {
  const root = process.cwd();
  return {
    key: path.join(root, DEV_TLS_SUBDIR, DEV_TLS_KEY_FILENAME),
    cert: path.join(root, DEV_TLS_SUBDIR, DEV_TLS_CERT_FILENAME),
  };
}

function pathsIfFilesExist(p: DevTlsPaths): DevTlsPaths | null {
  if (!existsSync(p.key) || !existsSync(p.cert)) {
    return null;
  }
  return p;
}

/** TLS for `Bun.serve` when env paths or dev default PEMs exist. */
export function resolveDevTlsPaths(): DevTlsPaths | null {
  const envKey = process.env[ENV_TLS_KEY_PATH];
  const envCert = process.env[ENV_TLS_CERT_PATH];
  if (
    envKey !== undefined &&
    envKey.length > 0 &&
    envCert !== undefined &&
    envCert.length > 0
  ) {
    return pathsIfFilesExist({ key: envKey, cert: envCert });
  }
  if (process.env[ENV_NODE_ENV] !== NODE_ENV_DEVELOPMENT) {
    return null;
  }
  return pathsIfFilesExist(defaultDevTlsPaths());
}

export function devTlsServeOptions(paths: DevTlsPaths) {
  return {
    tls: {
      key: Bun.file(paths.key),
      cert: Bun.file(paths.cert),
    },
  };
}
