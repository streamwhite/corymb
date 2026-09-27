import { existsSync } from "fs";
import path from "path";
import { ENV_MIGRATIONS_FOLDER } from "@/constants/migrations.js";

const DIR_NAME_DB = "db";
const MIGRATIONS_FOLDER = "migrations" as const;
const JOURNAL_SEGMENTS = ["meta", "_journal.json"] as const;

export { MIGRATIONS_FOLDER };

const BUN_RUNTIME_NAMES = new Set(["bun", "bun.exe"]);

function journalPath(folder: string): string {
  return path.join(folder, ...JOURNAL_SEGMENTS);
}

function hasMigrationsJournal(folder: string): boolean {
  return existsSync(journalPath(folder));
}

function fromExplicitEnv(): string | null {
  const raw = process.env[ENV_MIGRATIONS_FOLDER];
  if (raw === undefined || raw.trim() === "") {
    return null;
  }
  const resolved = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
  return hasMigrationsJournal(resolved) ? resolved : null;
}

/** Standalone `bun build --compile` binary: migrations live on disk next to the exe. */
function fromCompiledExecutableSibling(): string | null {
  const exe = process.execPath;
  if (BUN_RUNTIME_NAMES.has(path.basename(exe).toLowerCase())) {
    return null;
  }
  const candidate = path.join(path.dirname(exe), DIR_NAME_DB, MIGRATIONS_FOLDER);
  return hasMigrationsJournal(candidate) ? candidate : null;
}

/** Bundled `dist/cli.js`, tests (`src/db`), or dev entry: use `import.meta.dir`. */
function fromImportMetaDir(): string {
  const here = import.meta.dir;
  return path.basename(here) === DIR_NAME_DB
    ? path.join(here, MIGRATIONS_FOLDER)
    : path.join(here, DIR_NAME_DB, MIGRATIONS_FOLDER);
}

function migrationsMissingHint(): string {
  const sibling = path.join(
    path.dirname(process.execPath),
    DIR_NAME_DB,
    MIGRATIONS_FOLDER,
  );
  return `Expected SQL migrations (with meta/_journal.json) under ${fromImportMetaDir()} or—when using a compiled binary—next to the executable (${sibling}). Override with ${ENV_MIGRATIONS_FOLDER}=<absolute-or-relative-path>.`;
}

export function resolveMigrationsFolder(): string {
  const fromEnv = fromExplicitEnv();
  if (fromEnv !== null) {
    return fromEnv;
  }
  const fromExe = fromCompiledExecutableSibling();
  if (fromExe !== null) {
    return fromExe;
  }
  const fallback = fromImportMetaDir();
  if (!hasMigrationsJournal(fallback)) {
    throw new Error(`Cannot find migrations journal: ${migrationsMissingHint()}`);
  }
  return fallback;
}
