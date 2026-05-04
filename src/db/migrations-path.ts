import { existsSync } from "fs";
import path from "path";
import { ENV_MIGRATIONS_FOLDER } from "@/constants/migrations.js";

const DIR_NAME_DB = "db";
const DIR_NAME_MIGRATIONS = "migrations";
const JOURNAL_SEGMENTS = ["meta", "_journal.json"] as const;

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
  const base = path.basename(exe).toLowerCase();
  if (BUN_RUNTIME_NAMES.has(base)) {
    return null;
  }
  const candidate = path.join(
    path.dirname(exe),
    DIR_NAME_DB,
    DIR_NAME_MIGRATIONS,
  );
  return hasMigrationsJournal(candidate) ? candidate : null;
}

/** Bundled `dist/index.js`, tests (`src/db`), or dev entry: use `import.meta.dir`. */
function fromImportMetaDir(): string {
  const here = import.meta.dir;
  return path.basename(here) === DIR_NAME_DB
    ? path.join(here, DIR_NAME_MIGRATIONS)
    : path.join(here, DIR_NAME_DB, DIR_NAME_MIGRATIONS);
}

function migrationsMissingHint(): string {
  const exe = process.execPath;
  const sibling = path.join(
    path.dirname(exe),
    DIR_NAME_DB,
    DIR_NAME_MIGRATIONS,
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
    throw new Error(
      `Cannot find migrations journal: ${migrationsMissingHint()}`,
    );
  }
  return fallback;
}
