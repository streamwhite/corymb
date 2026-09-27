export const HEALTH_OK_BODY = {
  status: "ok",
} as const;

export const READY_STATUS_READY = "ready" as const;

export const READY_STATUS_UNAVAILABLE = "unavailable" as const;

export const READY_CHECK_CACHE = "cache" as const;

export const READY_CHECK_POSTGREST = "postgrest" as const;
