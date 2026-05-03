/** SQLite constraint violation when UNIQUE fails (better-sqlite3). */
export function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const code = "code" in error ? (error as { code?: string }).code : undefined;
  const msg = error instanceof Error ? error.message : "";
  return (
    code === "SQLITE_CONSTRAINT_UNIQUE" ||
    code === "SQLITE_CONSTRAINT" ||
    msg.includes("UNIQUE constraint failed")
  );
}
