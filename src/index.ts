export { createApp } from "@/app.js";
export type { AppInstance, CreateAppOptions } from "@/app.js";
export { startServer } from "@/server/start-server.js";
export type { StartServerOptions, StartServerResult } from "@/server/start-server.js";
export { DEFAULT_HTTP_PORT, ENV_HOST_KEY, ENV_PORT_KEY } from "@/constants/server.js";

export { readBoolEnv, readEnv, readEnvOrThrow, readListEnv } from "@/config/env.js";
export { loadAppConfig } from "@/config/app-config.js";
export type { AppConfig } from "@/config/app-config.js";
export { ConfigError, ConfigReader } from "@/config/validation.js";
export {
  createJsonReporter,
  createLogger,
  resolveLogLevelFromEnv,
} from "@/observability/logger.js";
export type {
  CreateLoggerOptions,
  Logger,
  LogFields,
} from "@/observability/logger.js";
export { resolveRequestId } from "@/observability/request-id.js";
export {
  AUDIT_ACTIONS,
  AUDIT_LOGGER_BINDING,
} from "@/audit/audit-types.js";
export type {
  AuditAction,
  AuditActor,
  AuditEvent,
  AuditOutcome,
  AuditSink,
} from "@/audit/audit-types.js";
export {
  createAuditLogger,
  createLoggerAuditSink,
} from "@/audit/audit-logger.js";
export type {
  CreateAuditLoggerOptions,
  RecordAuditInput,
} from "@/audit/audit-logger.js";
export {
  createFileAuditSink,
  createMemoryAuditSink,
} from "@/audit/audit-sinks.js";
export {
  createQueueAuditSink,
  withAudit,
} from "@/audit/audit-middleware.js";
export type {
  AuditMiddlewareOptions,
  AuditRecorder,
  AuditRule,
} from "@/audit/audit-middleware.js";
export {
  createNoopTaskQueue,
  createTaskQueue,
} from "@/tasks/task-queue.js";
export { createTasks, createTasksFromQueue } from "@/tasks/tasks.js";
export type { Tasks } from "@/tasks/tasks.js";
export {
  DEFAULT_TASK_BACKOFF_MS,
  DEFAULT_TASK_CONCURRENCY,
  DEFAULT_TASK_MAX_ATTEMPTS,
  DEFAULT_TASK_QUEUE_NAME,
} from "@/tasks/task-types.js";
export type {
  EnqueueOptions,
  TaskCounts,
  TaskFailure,
  TaskHandler,
  TaskQueue,
  TaskQueueOptions,
} from "@/tasks/task-types.js";
export { createObjectStorage } from "@/storage/storage.js";
export type { CreateStorageOptions } from "@/storage/storage.js";
export { createS3Storage } from "@/storage/s3-storage.js";
export { createFilesystemStorage } from "@/storage/filesystem-storage.js";
export { createMemoryStorage } from "@/storage/memory-storage.js";
export type {
  ObjectStorage,
  PresignOptions,
  PutObjectInput,
  PutObjectResult,
  StorageDriver,
  StoredObject,
} from "@/storage/storage-types.js";
export {
  STORAGE_DRIVER_FILESYSTEM,
  STORAGE_DRIVER_MEMORY,
  STORAGE_DRIVER_S3,
} from "@/storage/storage-types.js";
export { createIdempotencyGuard } from "@/http/idempotency.js";
export type { IdempotencyOptions } from "@/http/idempotency.js";
export {
  DEFAULT_IDEMPOTENCY_TTL_SECONDS,
  HEADER_IDEMPOTENCY_KEY,
  HEADER_IDEMPOTENT_REPLAY,
} from "@/constants/idempotency.js";
export { createGracefulShutdown } from "@/server/graceful-shutdown.js";
export type {
  GracefulShutdown,
  GracefulShutdownOptions,
  ShutdownStep,
} from "@/server/graceful-shutdown.js";
export {
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  ENV_SHUTDOWN_TIMEOUT_MS,
} from "@/constants/shutdown.js";
export {
  DEFAULT_LOG_LEVEL,
  ENV_LOG_LEVEL,
  HEADER_REQUEST_ID,
} from "@/constants/observability.js";
export type { LogLevel } from "@/constants/observability.js";
export { errorResponse } from "@/http/error-response.js";
export {
  AppError,
  ConflictError,
  ForbiddenError,
  isAppError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  UnauthorizedError,
  ValidationError,
} from "@/errors/app-error.js";
export type { AppErrorOptions } from "@/errors/app-error.js";
export { toErrorResponse } from "@/errors/to-response.js";
export type { ErrorBody } from "@/errors/to-response.js";
export {
  applyCors,
  corsPreflight,
  isCorsEnabled,
  resolveCorsFromEnv,
} from "@/http/cors.js";
export type { CorsConfig } from "@/constants/cors.js";

export type { Cache, CacheBundle } from "@/cache/cache-types.js";
export { createMemoryCache } from "@/cache/memory-cache.js";
export type { MemoryCacheOptions } from "@/cache/memory-cache.js";
export { createCacheBundle, closeCacheBundle } from "@/cache/client.js";
export type { CacheOptions } from "@/cache/client.js";
export {
  CACHE_DRIVER_MEMORY,
  CACHE_DRIVER_REDIS,
  ENV_CACHE_DRIVER,
  resolveCacheDriverFromEnv,
} from "@/constants/cache-driver.js";
export type { CacheDriver } from "@/constants/cache-driver.js";
export {
  DEFAULT_MEMORY_CACHE_MAX_ITEMS,
  ENV_MEMORY_CACHE_MAX_ITEMS,
  ENV_MEMORY_CACHE_TTL_SECONDS,
} from "@/constants/memory-cache.js";
export type { Mailer, MailMessage } from "@/mail/mailer-types.js";
export type { EventBus } from "@/realtime/event-bus.js";
export { createMemoryEventBus } from "@/realtime/event-bus.js";
export { publishRealtimeEvent } from "@/realtime/publish.js";
export type { RealtimeEvent } from "@/constants/realtime.js";
export { REALTIME_EVENTS_CHANNEL } from "@/constants/realtime.js";
export {
  withRateLimit,
  resetDefaultRateLimiterForTests,
} from "@/server/with-rate-limit.js";
export {
  createRateLimiter,
  rateLimitClientKey,
} from "@/http/rate-limit.js";

export { compose, createHandler, passthrough } from "@/middleware/compose.js";
export { createMiddlewareRegistry } from "@/middleware/registry.js";
export type { MiddlewareRegistry } from "@/middleware/registry.js";
export type {
  Middleware,
  MiddlewareContext,
  ContextData,
  NextFunction,
} from "@/middleware/middleware-types.js";
export {
  withAccessLog,
  withErrorHandler,
  withRequestId,
} from "@/middleware/builtin/observability.js";
export { withCompression } from "@/middleware/builtin/compression.js";
export type { CompressionOptions } from "@/middleware/builtin/compression.js";
export {
  readValidated,
  validate,
  withValidation,
} from "@/middleware/builtin/validation.js";
export type {
  ValidationTarget,
  Validator,
} from "@/middleware/builtin/validation.js";
export {
  COMPRESSION_ALGORITHMS,
  COMPRESSION_DEFAULT_THRESHOLD,
} from "@/constants/compression.js";
export type { CompressionAlgorithm } from "@/constants/compression.js";

export {
  formatClearCookie,
  formatSetCookie,
  formatSetCookie as serializeCookieHeader,
  parseCookies,
  readCookieValue,
  readSignedCookie,
  serializeClearedCookie,
  serializeCookie,
  signCookieValue,
  verifyCookieValue,
  withCookies,
} from "@/http/cookies.js";
export type { CookieOptions } from "@/http/cookies.js";
export {
  isMultipart,
  parseMultipartUpload,
} from "@/http/multipart.js";
export type {
  ParsedUpload,
  ParseUploadOptions,
  UploadedFile,
} from "@/http/multipart.js";
export {
  CONTENT_TYPE_SSE,
  createSseResponse,
  createStreamResponse,
  formatSseEvent,
  streamFromIterable,
} from "@/http/streaming.js";
export type { SseController, SseEvent } from "@/http/streaming.js";

export {
  bearerToken,
  getOptionalSession,
  readSession,
  readUser,
  withSession,
} from "@/auth/session-middleware.js";
export type { SessionInfo, SessionUser } from "@/auth/session-middleware.js";

export {
  createWebSocketServer,
  createWebSocketUpgrade,
  makeWebSocketData,
} from "@/websocket/websocket.js";
export type {
  UpgradeCapableServer,
  WebSocketConnection,
  WebSocketData,
  WebSocketEndpoint,
  WebSocketLimits,
  WebSocketRouteHandlers,
  WebSocketServer,
} from "@/websocket/websocket.js";
export type {
  RateLimiter,
  RateLimitOptions,
  RateLimitResult,
} from "@/http/rate-limit.js";
export {
  RATE_LIMIT_DEFAULT_MAX,
  RATE_LIMIT_STRATEGY_RELAXED,
  RATE_LIMIT_STRATEGY_STANDARD,
  RATE_LIMIT_STRATEGY_STRICT,
  RATE_LIMIT_WINDOW_MS,
} from "@/constants/rate-limit.js";
export type { RateLimitStrategy } from "@/constants/rate-limit.js";

export { createPostgrestClient } from "@/data/postgrest-client.js";
export type {
  CreatePostgrestClientOptions,
  PostgrestClient,
} from "@/data/postgrest-client.js";
export { PostgrestError } from "@/data/postgrest-error.js";
export type {
  PostgrestAuth,
  PostgrestResponse,
  RpcArgs,
} from "@/data/postgrest-types.js";
export { resolvePostgrestConfigFromEnv } from "@/constants/postgrest.js";
export type { PostgrestConfig } from "@/constants/postgrest.js";

export {
  APP_DB_SCHEMA,
  AUTH_DB_SCHEMA,
  ENV_DATABASE_URL,
  isPostgresUrl,
} from "@/constants/database.js";
export type { DatabaseConfig } from "@/constants/database.js";
export { migrateDatabase } from "@/db/migrate.js";
export { createAdminDb, closeAdminDb } from "@/db/admin-client.js";
export type { AdminDb, AdminDbOptions } from "@/db/admin-client.js";
export {
  migrationStatus,
  pendingMigrations,
} from "@/db/migrations-status.js";
export type { MigrationStatusEntry } from "@/db/migrations-status.js";
export {
  withSavepoint,
  withTransaction,
} from "@/db/transaction.js";
export type { SavepointClient, TransactionClient } from "@/db/transaction.js";
export {
  createUnitOfWork,
  runInTransaction,
} from "@/db/unit-of-work.js";
export type {
  RegisterStep,
  UnitOfWork,
  UnitOfWorkStep,
} from "@/db/unit-of-work.js";

export {
  buildPublicJwks,
  writeJwksFile,
} from "@/auth/jwks.js";
export type { JwksDocument } from "@/auth/jwks.js";
export {
  AUTH_JWKS_PATH,
  AUTH_JWT_ROLE_AUTHENTICATED,
  AUTH_JWT_ROLE_CLAIM,
} from "@/constants/better-auth.js";

export {
  blockRequestIfBot,
  detectRequestBot,
  setBotDetectionModeForTests,
  withBotDetection,
} from "@/bot/bot-guard.js";
export { classifyUserAgent, shouldBlockBot } from "@/bot/bot-detection.js";
export type { BotClassification, BotKind } from "@/bot/bot-detection.js";
export { buildRobotsTxt, robotsTxtResponse } from "@/bot/bot-response.js";
export type { BotDetectionMode, BotTokenLists } from "@/constants/bot.js";
export {
  BOT_DETECTION_MODE_BLOCK,
  BOT_DETECTION_MODE_LOG,
  BOT_DETECTION_MODE_OFF,
} from "@/constants/bot.js";
export {
  isSessionFresh,
  requireSensitiveVerification,
  withSensitiveOperation,
} from "@/auth/sensitive-guard.js";
export type {
  SensitiveGuardDeps,
  SensitiveRouteHandler,
} from "@/auth/sensitive-guard.js";
export { createSensitiveVerifyStore } from "@/auth/sensitive-verify-store.js";
export type { SensitiveVerifyStore } from "@/auth/sensitive-verify-store.js";
export { AUTH_SESSION_VERIFY_PATH } from "@/constants/better-auth.js";
export { SENSITIVE_VERIFICATION_REQUIRED_CODE } from "@/constants/sensitive-auth.js";
export type { DocsAccessMode } from "@/constants/docs-access.js";
export {
  DOCS_BASE_PATH,
  HEALTH_BASE_PATH,
  READY_BASE_PATH,
  REALTIME_EVENTS_BASE_PATH,
  ROBOTS_TXT_PATH,
  UI_AUTH_BASE_PATH,
  UPLOAD_BASE_PATH,
} from "@/constants/routes.js";
