import path from "path";

const DIR_NAME_DB = "db";
const DIR_NAME_MIGRATIONS = "migrations";

/** Works for `src/db/*`, `dist/db/*` (tsc), and a single bundle at `dist/index.js` (bun build). */
export function resolveMigrationsFolder(): string {
  const here = import.meta.dir;
  return path.basename(here) === DIR_NAME_DB
    ? path.join(here, DIR_NAME_MIGRATIONS)
    : path.join(here, DIR_NAME_DB, DIR_NAME_MIGRATIONS);
}
