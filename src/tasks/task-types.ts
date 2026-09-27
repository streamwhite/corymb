import type { JobsOptions } from "bullmq";

export const DEFAULT_TASK_MAX_ATTEMPTS = 3 as const;

export const DEFAULT_TASK_BACKOFF_MS = 200 as const;

export const DEFAULT_TASK_CONCURRENCY = 4 as const;

export const DEFAULT_TASK_QUEUE_NAME = "default" as const;

/** BullMQ priority ranges 0..2_097_151; higher numbers run first. */
export const TASK_PRIORITY_MIN = 0 as const;
export const TASK_PRIORITY_MAX = 2_097_151 as const;

export const TASK_STATUS_COMPLETED = "completed" as const;
export const TASK_STATUS_FAILED = "failed" as const;
export const TASK_STATUS_ACTIVE = "active" as const;
export const TASK_STATUS_WAITING = "waiting" as const;
export const TASK_STATUS_DELAYED = "delayed" as const;

export type TaskStatus =
  | typeof TASK_STATUS_COMPLETED
  | typeof TASK_STATUS_FAILED
  | typeof TASK_STATUS_ACTIVE
  | typeof TASK_STATUS_WAITING
  | typeof TASK_STATUS_DELAYED;

/** Context passed to a task handler. */
export type TaskContext = {
  /** Job id. */
  id: string;
  /** Job name. */
  name: string;
  /** Attempt number (1-based). */
  attempt: number;
  /** Total attempts configured for this job. */
  maxAttempts: number;
  /** Reports progress (number or structured object). */
  updateProgress: (progress: number | Record<string, unknown>) => Promise<void>;
  /** Aborts when the job is cancelled; pass to fetch/loops. */
  signal: AbortSignal;
};

export type TaskHandler<T = unknown> = (
  payload: T,
  ctx: TaskContext,
) => void | Promise<void>;

export type TaskFailure = {
  name: string;
  attempts: number;
  error: Error;
  payload: unknown;
};

export type TaskQueueOptions = {
  /** BullMQ queue name (default `default`). */
  name?: string;
  /** Redis connection URL; defaults to `REDIS_URL`/`VALKEY_URL`. */
  redisUrl?: string;
  /** Keyspace prefix for BullMQ keys. */
  prefix?: string;
  /** Default worker concurrency. */
  concurrency?: number;
  /** Per-job-name concurrency overrides (separate worker pools). */
  concurrencyByName?: Record<string, number>;
  maxAttempts?: number;
  /** Base delay for exponential backoff (ms). */
  backoffMs?: number;
  /** How long completed jobs are retained for `counts()` (seconds). */
  completedRetentionSeconds?: number;
  /** Called when a job exhausts all attempts and moves to `failed`. */
  onDeadLetter?: (failure: TaskFailure) => void | Promise<void>;
};

export type EnqueueOptions = {
  name: string;
  payload?: unknown;
  /** Override the default max attempts for this job. */
  maxAttempts?: number;
  /** Delay before the job becomes active (ms). */
  delayMs?: number;
  /** Custom BullMQ job id (deduplication key). */
  jobId?: string;
  /** Higher runs first (0..2_097_151). */
  priority?: number;
};

export type TaskCounts = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
};

export type ScheduleOptions = {
  /** Scheduler id (unique per schedule). */
  id: string;
  /** Job name (must have a registered handler). */
  name: string;
  payload?: unknown;
  /** Cron pattern (e.g. `0 * * * *`) or fixed interval in ms (not both). */
  pattern?: string;
  everyMs?: number;
  /** Run once immediately after registering. */
  immediately?: boolean;
  /** IANA timezone for cron patterns. */
  tz?: string;
  priority?: number;
  maxAttempts?: number;
};

export type ScheduledJobInfo = {
  id: string;
  name: string;
  pattern?: string;
  everyMs?: number;
  next?: number;
};

/** Snapshot of a job's state. */
export type TaskJobInfo = {
  id: string;
  name: string;
  status: TaskStatus | "unknown";
  progress: number | Record<string, unknown>;
  attemptsMade: number;
  failedReason?: string;
};

export type TaskQueue = {
  register: <T = unknown>(name: string, handler: TaskHandler<T>) => void;
  enqueue: (options: EnqueueOptions) => Promise<string>;
  /** Number of in-flight jobs (active). */
  inFlight: () => Promise<number>;
  counts: () => Promise<TaskCounts>;
  /** Current state of a job by id. */
  getJob: (id: string) => Promise<TaskJobInfo | null>;
  /** Removes a job (cancels if waiting/delayed; active jobs are aborted). */
  cancel: (id: string) => Promise<boolean>;
  /** Registers/updates a repeatable (cron) or interval schedule. */
  schedule: (options: ScheduleOptions) => Promise<void>;
  /** Removes a schedule by id. */
  unschedule: (id: string) => Promise<void>;
  /** Lists registered schedules. */
  schedules: () => Promise<ScheduledJobInfo[]>;
  close: () => Promise<void>;
};

/** Job options derived from queue/request options. */
export type TaskJobOptions = JobsOptions;
