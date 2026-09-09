import { existsSync } from "fs";
import path from "path";
import type { DbDialect } from "@/constants/database.js";
import { ENV_MIGRATIONS_FOLDER } from "@/constants/migrations.js";

const DIR_NAME_DB = "db";
const MIGRATIONS_FOLDER_SQLITE = "migrations" as const;
const MIGRATIONS_FOLDER_POSTGRES = "migrations-pg" as const;
const JOURNAL_SEGMENTS = ["meta", "_journal.json"] as const;

export { MIGRATIONS_FOLDER_POSTGRES, MIGRATIONS_FOLDER_SQLITE };

const BUN_RUNTIME_NAMES = new Set(["bun", "bun.exe"]);

function migrationsDirName(dialect: DbDialect): string {
  return dialect === "postgres"
    ? MIGRATIONS_FOLDER_POSTGRES
    : MIGRATIONS_FOLDER_SQLITE;
}

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
function fromCompiledExecutableSibling(dialect: DbDialect): string | null {
  const exe = process.execPath;
  const base = path.basename(exe).toLowerCase();
  if (BUN_RUNTIME_NAMES.has(base)) {
    return null;
  }
  const candidate = path.join(
    path.dirname(exe),
    DIR_NAME_DB,
    migrationsDirName(dialect),
  );
  return hasMigrationsJournal(candidate) ? candidate : null;
}

/** Bundled `dist/index.js`, tests (`src/db`), or dev entry: use `import.meta.dir`. */
function fromImportMetaDir(dialect: DbDialect): string {
  const dirName = migrationsDirName(dialect);
  const here = import.meta.dir;
  return path.basename(here) === DIR_NAME_DB
    ? path.join(here, dirName)
    : path.join(here, DIR_NAME_DB, dirName);
}

function migrationsMissingHint(dialect: DbDialect): string {
  const exe = process.execPath;
  const sibling = path.join(
    path.dirname(exe),
    DIR_NAME_DB,
    migrationsDirName(dialect),
  );
  return `Expected SQL migrations (with meta/_journal.json) under ${fromImportMetaDir(dialect)} or—when using a compiled binary—next to the executable (${sibling}). Override with ${ENV_MIGRATIONS_FOLDER}=<absolute-or-relative-path>.`;
}

export function resolveMigrationsFolder(dialect: DbDialect = "sqlite"): string {
  const fromEnv = fromExplicitEnv();
  if (fromEnv !== null) {
    return fromEnv;
  }
  const fromExe = fromCompiledExecutableSibling(dialect);
  if (fromExe !== null) {
    return fromExe;
  }
  const fallback = fromImportMetaDir(dialect);
  if (!hasMigrationsJournal(fallback)) {
    throw new Error(
      `Cannot find migrations journal: ${migrationsMissingHint(dialect)}`,
    );
  }
  return fallback;
}
