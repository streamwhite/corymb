/** Resolve against `NODE_ENV` (see `isNodeEnvDevelopment`). */
export const DOCS_ACCESS_MODE_ENV = "env" as const;

/** Treat as development (e.g. tests). */
export const DOCS_ACCESS_MODE_DEVELOPMENT = "development" as const;

/** Hide `/docs` (e.g. tests simulating production). */
export const DOCS_ACCESS_MODE_PRODUCTION = "production" as const;

export type DocsAccessMode =
  | typeof DOCS_ACCESS_MODE_ENV
  | typeof DOCS_ACCESS_MODE_DEVELOPMENT
  | typeof DOCS_ACCESS_MODE_PRODUCTION;

export const DEFAULT_DOCS_ACCESS_MODE = DOCS_ACCESS_MODE_ENV;
