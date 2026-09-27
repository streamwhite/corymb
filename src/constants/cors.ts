export const ENV_CORS_ORIGINS = "CORS_ORIGINS" as const;

export const ENV_CORS_CREDENTIALS = "CORS_CREDENTIALS" as const;

export const CORS_WILDCARD = "*" as const;

export const HEADER_ORIGIN = "Origin" as const;

export const HEADER_ALLOW_ORIGIN = "Access-Control-Allow-Origin" as const;

export const HEADER_ALLOW_CREDENTIALS =
  "Access-Control-Allow-Credentials" as const;

export const HEADER_ALLOW_METHODS = "Access-Control-Allow-Methods" as const;

export const HEADER_ALLOW_HEADERS = "Access-Control-Allow-Headers" as const;

export const HEADER_MAX_AGE = "Access-Control-Max-Age" as const;

export const HEADER_VARY = "Vary" as const;

export const DEFAULT_CORS_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
] as const;

export const DEFAULT_CORS_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-Request-Id",
] as const;

export const DEFAULT_CORS_MAX_AGE_SECONDS = 600;

export type CorsConfig = {
  origins: string[];
  credentials: boolean;
  methods: string[];
  headers: string[];
  maxAgeSeconds: number;
};
