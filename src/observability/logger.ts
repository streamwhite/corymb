import { createConsola, LogLevels, type LogObject } from "consola";
import {
  DEFAULT_LOG_LEVEL,
  ENV_LOG_LEVEL,
  isLogLevel,
  type LogLevel,
  REDACTED_LOG_KEYS,
  shouldLog,
} from "@/constants/observability.js";

export type LogFields = Record<string, unknown>;

export type Logger = {
  debug: (message: string, fields?: LogFields) => void;
  info: (message: string, fields?: LogFields) => void;
  warn: (message: string, fields?: LogFields) => void;
  error: (message: string, fields?: LogFields) => void;
  child: (bindings: LogFields) => Logger;
};

type LogWriter = (level: LogLevel, line: string) => void;

const REDACTED = "[redacted]" as const;
const SENSITIVE_KEYS = new Set<string>(REDACTED_LOG_KEYS);

const CONSOLA_LEVEL: Record<LogLevel, number> = {
  debug: LogLevels.debug,
  info: LogLevels.info,
  warn: LogLevels.warn,
  error: LogLevels.error,
};

export function resolveLogLevelFromEnv(
  env: Record<string, string | undefined> = process.env,
): LogLevel {
  const raw = env[ENV_LOG_LEVEL]?.toLowerCase();
  return raw !== undefined && isLogLevel(raw) ? raw : DEFAULT_LOG_LEVEL;
}

function redact(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : value;
  }
  return out;
}

function defaultWriter(level: LogLevel, line: string): void {
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

/** Splits consola args into `[message, fields]` as passed by the framework logger. */
function splitArgs(logObj: LogObject): { message: string; fields: LogFields } {
  const args = logObj.args ?? [];
  const message =
    typeof args[0] === "string" ? args[0] : (logObj.message ?? "");
  const fields =
    typeof args[1] === "object" && args[1] !== null
      ? (args[1] as LogFields)
      : {};
  return { message, fields };
}

/** Consola reporter emitting one redacted JSON object per line. */
export function createJsonReporter(
  write: LogWriter = defaultWriter,
): { log: (logObj: LogObject) => void } {
  return {
    log(logObj: LogObject): void {
      const level = logObj.type as LogLevel;
      const { message, fields } = splitArgs(logObj);
      const line = JSON.stringify({
        level: logObj.type,
        time: logObj.date.toISOString(),
        message,
        ...redact(fields),
      });
      write(level, line);
    },
  };
}

function emit(
  consola: ReturnType<typeof createConsola>,
  level: LogLevel,
  message: string,
  fields: LogFields | undefined,
): void {
  const payload = fields ?? {};
  if (level === "debug") consola.debug(message, payload);
  else if (level === "warn") consola.warn(message, payload);
  else if (level === "error") consola.error(message, payload);
  else consola.info(message, payload);
}

export type CreateLoggerOptions = {
  level?: LogLevel;
  /** Custom sink (tests / transports). Defaults to JSON lines on the console. */
  writer?: LogWriter;
  /** Use consola's fancy human-readable reporter instead of JSON. */
  pretty?: boolean;
};

export function createLogger(
  bindings: LogFields = {},
  options: CreateLoggerOptions = {},
): Logger {
  const level = options.level ?? resolveLogLevelFromEnv();
  const reporters =
    options.pretty === true
      ? undefined
      : [createJsonReporter(options.writer)];
  const consola = createConsola({
    level: CONSOLA_LEVEL[level],
    ...(reporters === undefined ? {} : { reporters }),
  });

  const loggerFor = (extra: LogFields): Logger => {
    const merged = { ...bindings, ...extra };
    return {
      debug: (message, fields) =>
        shouldLog("debug", level) &&
        emit(consola, "debug", message, { ...merged, ...fields }),
      info: (message, fields) =>
        shouldLog("info", level) &&
        emit(consola, "info", message, { ...merged, ...fields }),
      warn: (message, fields) =>
        shouldLog("warn", level) &&
        emit(consola, "warn", message, { ...merged, ...fields }),
      error: (message, fields) =>
        shouldLog("error", level) &&
        emit(consola, "error", message, { ...merged, ...fields }),
      child: (childBindings) => loggerFor(childBindings),
    };
  };

  return loggerFor({});
}
