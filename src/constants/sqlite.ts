export const ENV_SQLITE_PATH = "SQLITE_PATH" as const;

/** Sentinel path for an ephemeral database (tests). */
export const SQLITE_IN_MEMORY = ":memory:" as const;

export const DEFAULT_DATA_DIR = "data" as const;

export const DEFAULT_DB_FILENAME = "items.sqlite" as const;
