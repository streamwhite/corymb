export const HEADER_IDEMPOTENCY_KEY = "Idempotency-Key" as const;

export const HEADER_IDEMPOTENT_REPLAY = "Idempotent-Replay" as const;

export const ENV_IDEMPOTENCY_TTL_SECONDS = "IDEMPOTENCY_TTL_SECONDS" as const;

export const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export const IDEMPOTENCY_KEY_MAX_CHARS = 255 as const;

export const IDEMPOTENCY_KEY_PREFIX = "idem" as const;

export const IDEMPOTENCY_STATUS_IN_PROGRESS = "in_progress" as const;

export const IDEMPOTENCY_STATUS_COMPLETED = "completed" as const;
