export const HEALTH_SEGMENT = "health" as const;

export const HEALTH_BASE_PATH = `/${HEALTH_SEGMENT}` as const;

export const READY_SEGMENT = "ready" as const;

/** Readiness probe: verifies downstream dependencies (cache, PostgREST). */
export const READY_BASE_PATH = `/${READY_SEGMENT}` as const;

export const UI_SEGMENT = "ui" as const;

export const UI_AUTH_BASE_PATH = `/${UI_SEGMENT}` as const;

export const DOCS_SEGMENT = "docs" as const;

export const DOCS_BASE_PATH = `/${DOCS_SEGMENT}` as const;

export const UPLOAD_SEGMENT = "upload" as const;

export const UPLOAD_BASE_PATH = `/${UPLOAD_SEGMENT}` as const;

export const REALTIME_SEGMENT = "realtime" as const;

export const EVENTS_SEGMENT = "events" as const;

export const REALTIME_EVENTS_BASE_PATH =
  `/${REALTIME_SEGMENT}/${EVENTS_SEGMENT}` as const;

export const ROBOTS_SEGMENT = "robots.txt" as const;

export const ROBOTS_TXT_PATH = `/${ROBOTS_SEGMENT}` as const;
