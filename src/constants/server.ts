export const ENV_PORT_KEY = "PORT" as const;

export const DEFAULT_HTTP_PORT = 3000;

export const HOST_FALLBACK = "0.0.0.0" as const;

/** Signals sent by `tsx watch` / process managers when restarting (graceful close). */
export const SIGNAL_SIGINT = "SIGINT" as const;

export const SIGNAL_SIGTERM = "SIGTERM" as const;
