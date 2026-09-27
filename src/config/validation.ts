import { isLogLevel, type LogLevel } from "@/constants/observability.js";

export class ConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid configuration:\n- ${issues.join("\n- ")}`);
    this.name = "ConfigError";
    this.issues = issues;
  }
}

type Env = Record<string, string | undefined>;

function isPresent(raw: string | undefined): raw is string {
  return raw !== undefined && raw.trim().length > 0;
}

/**
 * Collects environment issues instead of throwing on the first one, so
 * deployments report every misconfiguration in a single message.
 */
export class ConfigReader {
  private readonly issues: string[] = [];

  constructor(private readonly env: Env) {}

  private raw(key: string): string | undefined {
    const value = this.env[key];
    return isPresent(value) ? value.trim() : undefined;
  }

  requiredString(key: string): string {
    const value = this.raw(key);
    if (value === undefined) {
      this.issues.push(`${key} is required`);
      return "";
    }
    return value;
  }

  secret(key: string, minLength: number): string {
    const value = this.requiredString(key);
    if (value.length > 0 && value.length < minLength) {
      this.issues.push(`${key} must be at least ${String(minLength)} characters`);
    }
    return value;
  }

  optionalString(key: string, fallback?: string): string | undefined {
    return this.raw(key) ?? fallback;
  }

  int(key: string, fallback: number): number {
    const raw = this.raw(key);
    if (raw === undefined) {
      return fallback;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      this.issues.push(`${key} must be an integer`);
      return fallback;
    }
    return parsed;
  }

  bool(key: string, fallback: boolean): boolean {
    const raw = this.raw(key)?.toLowerCase();
    if (raw === undefined) {
      return fallback;
    }
    if (["true", "1", "yes", "on"].includes(raw)) return true;
    if (["false", "0", "no", "off"].includes(raw)) return false;
    this.issues.push(`${key} must be a boolean`);
    return fallback;
  }

  list(key: string): string[] {
    const raw = this.raw(key);
    if (raw === undefined) {
      return [];
    }
    return raw
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  optionalUrl(key: string): string | undefined {
    const raw = this.raw(key);
    if (raw === undefined) {
      return undefined;
    }
    try {
      return new URL(raw).origin;
    } catch {
      this.issues.push(`${key} must be a valid URL`);
      return undefined;
    }
  }

  postgresUrl(key: string): string {
    const raw = this.raw(key);
    if (raw === undefined) {
      this.issues.push(`${key} is required (PostgreSQL connection URL)`);
      return "";
    }
    const lower = raw.toLowerCase();
    if (!lower.startsWith("postgres://") && !lower.startsWith("postgresql://")) {
      this.issues.push(`${key} must be a PostgreSQL URL`);
    }
    return raw;
  }

  logLevel(key: string, fallback: LogLevel): LogLevel {
    const raw = this.raw(key)?.toLowerCase();
    if (raw === undefined) {
      return fallback;
    }
    if (!isLogLevel(raw)) {
      this.issues.push(`${key} must be one of: debug, info, warn, error`);
      return fallback;
    }
    return raw;
  }

  addIssue(message: string): void {
    this.issues.push(message);
  }

  finish(): void {
    if (this.issues.length > 0) {
      throw new ConfigError([...this.issues]);
    }
  }
}
