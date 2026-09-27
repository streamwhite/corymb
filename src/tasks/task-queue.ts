import {
  Queue,
  Worker,
  type Job,
  type JobsOptions,
  type RedisOptions,
  type WorkerOptions,
} from "bullmq";
import {
  DEFAULT_TASK_BACKOFF_MS,
  DEFAULT_TASK_CONCURRENCY,
  DEFAULT_TASK_MAX_ATTEMPTS,
  DEFAULT_TASK_QUEUE_NAME,
  TASK_PRIORITY_MAX,
  TASK_PRIORITY_MIN,
  type EnqueueOptions,
  type ScheduleOptions,
  type ScheduledJobInfo,
  type TaskContext,
  type TaskCounts,
  type TaskFailure,
  type TaskHandler,
  type TaskJobInfo,
  type TaskQueue,
  type TaskQueueOptions,
  type TaskStatus,
} from "@/tasks/task-types.js";
import type { Logger } from "@/observability/logger.js";

const TASKS_LOGGER_COMPONENT = "tasks" as const;
const BULLMQ_PREFIX = "bull" as const;
const NO_WAITING = 0;
const FIRST_ATTEMPT = 1;
/** Keep completed jobs briefly so `counts()` reflects recent activity. */
const DEFAULT_COMPLETED_RETENTION_SECONDS = 3600;
const DEFAULT_TASK_SCHEDULE_EVERY_MS = 60_000;
const ID_SEPARATOR = ":" as const;

export type TaskQueueDeps = {
  logger: Logger;
};

function parseRedisUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  const dbPath = parsed.pathname.replace(/^\//, "");
  return {
    host: parsed.hostname,
    port: parsed.port.length > 0 ? Number(parsed.port) : 6379,
    username: parsed.username.length > 0 ? parsed.username : undefined,
    password: parsed.password.length > 0 ? parsed.password : undefined,
    db: dbPath.length > 0 ? Number(dbPath) : 0,
    ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

function clampPriority(priority: number | undefined): number | undefined {
  if (priority === undefined) return undefined;
  return Math.min(Math.max(priority, TASK_PRIORITY_MIN), TASK_PRIORITY_MAX);
}

function jobOptions(
  options: TaskQueueOptions,
  opts: EnqueueOptions,
): JobsOptions {
  const attempts =
    opts.maxAttempts ?? options.maxAttempts ?? DEFAULT_TASK_MAX_ATTEMPTS;
  const delay =
    opts.delayMs !== undefined && opts.delayMs > 0 ? opts.delayMs : undefined;
  const priority = clampPriority(opts.priority);
  return {
    attempts,
    backoff: {
      type: "exponential",
      delay: options.backoffMs ?? DEFAULT_TASK_BACKOFF_MS,
    },
    removeOnComplete: {
      age:
        options.completedRetentionSeconds ??
        DEFAULT_COMPLETED_RETENTION_SECONDS,
    },
    removeOnFail: false,
    ...(opts.jobId === undefined ? {} : { jobId: opts.jobId }),
    ...(delay === undefined ? {} : { delay }),
    ...(priority === undefined ? {} : { priority }),
  };
}

function toFailure(job: Job, err: Error): TaskFailure {
  return {
    name: job.name,
    attempts: job.attemptsMade,
    error: err,
    payload: job.data,
  };
}

async function resolveJobInfo(
  job: Job,
  queue: Queue,
  id: string,
): Promise<TaskJobInfo> {
  const state = (await job.getState().catch(() => "unknown")) as TaskStatus;
  const refreshed = (await queue.getJob(id)) ?? job;
  return {
    id,
    name: refreshed.name,
    status: state,
    progress: refreshed.progress as number | Record<string, unknown>,
    attemptsMade: refreshed.attemptsMade,
    ...(refreshed.failedReason === undefined
      ? {}
      : { failedReason: refreshed.failedReason }),
  };
}

export function createNoopTaskQueue(): TaskQueue {
  const emptyCounts = (): TaskCounts => ({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  });
  return {
    register: () => {},
    enqueue: async () => "",
    inFlight: async () => 0,
    counts: async () => emptyCounts(),
    getJob: async () => null,
    cancel: async () => false,
    schedule: async () => {},
    unschedule: async () => {},
    schedules: async () => [],
    close: async () => {},
  };
}

/**
 * Redis-backed background job queue built on BullMQ. Supports job-level retries
 * with exponential backoff, priorities, per-job-name concurrency (one worker
 * pool per name), progress reporting, cancellation and cron/interval schedules.
 */
export function createTaskQueue(
  options: TaskQueueOptions,
  deps: TaskQueueDeps,
): TaskQueue {
  const queueName = options.name ?? DEFAULT_TASK_QUEUE_NAME;
  const connection = parseRedisUrl(
    options.redisUrl ?? process.env.REDIS_URL ?? process.env.VALKEY_URL ?? "",
  );
  const prefix = options.prefix ?? BULLMQ_PREFIX;
  const queue = new Queue(queueName, { connection, prefix });
  const handlers = new Map<string, TaskHandler>();
  const workers = new Map<string, Worker>();
  const activeControllers = new Map<string, AbortController>();

  function concurrencyFor(name: string): number {
    return (
      options.concurrencyByName?.[name] ??
      options.concurrency ??
      DEFAULT_TASK_CONCURRENCY
    );
  }

  async function runJob(job: Job): Promise<void> {
    const handler = handlers.get(job.name);
    if (handler === undefined) {
      throw new Error(`No handler registered for task "${job.name}"`);
    }
    const id = job.id ?? "";
    const controller = new AbortController();
    if (id.length > 0) activeControllers.set(id, controller);
    const ctx: TaskContext = {
      id,
      name: job.name,
      attempt: job.attemptsMade + FIRST_ATTEMPT,
      maxAttempts: job.opts.attempts ?? DEFAULT_TASK_MAX_ATTEMPTS,
      updateProgress: (progress) => job.updateProgress(progress),
      signal: controller.signal,
    };
    try {
      await handler(job.data, ctx);
    } finally {
      activeControllers.delete(id);
    }
  }

  function attachEvents(worker: Worker): void {
    worker.on("failed", (job, err) => {
      if (job === undefined) return;
      const attempts = job.opts.attempts ?? DEFAULT_TASK_MAX_ATTEMPTS;
      if (job.attemptsMade >= attempts) {
        void handleDeadLetter(toFailure(job, err));
      } else {
        deps.logger.warn("task retry", {
          component: TASKS_LOGGER_COMPONENT,
          task: job.name,
          attempts: job.attemptsMade,
          error: err.message,
        });
      }
    });
    worker.on("error", (err) => {
      deps.logger.error("task worker error", {
        component: TASKS_LOGGER_COMPONENT,
        error: err.message,
      });
    });
  }

  function ensureWorker(name: string): Worker {
    const existing = workers.get(name);
    if (existing !== undefined) return existing;
    const workerOptions: WorkerOptions = {
      connection,
      prefix,
      name,
      concurrency: concurrencyFor(name),
    };
    const worker = new Worker(queueName, runJob, workerOptions);
    attachEvents(worker);
    workers.set(name, worker);
    return worker;
  }

  async function handleDeadLetter(failure: TaskFailure): Promise<void> {
    deps.logger.error("task dead-lettered", {
      component: TASKS_LOGGER_COMPONENT,
      task: failure.name,
      attempts: failure.attempts,
      error: failure.error.message,
    });
    if (options.onDeadLetter === undefined) return;
    try {
      await options.onDeadLetter(failure);
    } catch (err) {
      deps.logger.error("task dead-letter hook failed", {
        component: TASKS_LOGGER_COMPONENT,
        task: failure.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    register<T = unknown>(name: string, handler: TaskHandler<T>): void {
      handlers.set(name, handler as TaskHandler);
      ensureWorker(name);
    },
    async enqueue(opts): Promise<string> {
      const job = await queue.add(
        opts.name,
        opts.payload ?? null,
        jobOptions(options, opts),
      );
      return job.id ?? "";
    },
    async inFlight(): Promise<number> {
      const counts = await queue.getJobCounts("active");
      return counts.active ?? NO_WAITING;
    },
    async counts(): Promise<TaskCounts> {
      const c = await queue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
      );
      return {
        waiting: c.waiting ?? NO_WAITING,
        active: c.active ?? NO_WAITING,
        completed: c.completed ?? NO_WAITING,
        failed: c.failed ?? NO_WAITING,
        delayed: c.delayed ?? NO_WAITING,
      };
    },
    async getJob(id: string): Promise<TaskJobInfo | null> {
      const job = await queue.getJob(id);
      if (job === undefined) return null;
      return resolveJobInfo(job, queue, id);
    },
    async cancel(id: string): Promise<boolean> {
      activeControllers.get(id)?.abort();
      const job = await queue.getJob(id);
      if (job === undefined) return false;
      if ((await job.getState()) === "active") {
        return true; // handler must honor ctx.signal to stop promptly
      }
      await job.remove().catch(() => {});
      return true;
    },
    async schedule(opts: ScheduleOptions): Promise<void> {
      const repeat =
        opts.pattern !== undefined
          ? {
              pattern: opts.pattern,
              ...(opts.tz === undefined ? {} : { tz: opts.tz }),
              ...(opts.immediately === true ? { immediately: true } : {}),
            }
          : { every: opts.everyMs ?? DEFAULT_TASK_SCHEDULE_EVERY_MS };
      ensureWorker(opts.name);
      await queue.upsertJobScheduler(opts.id, repeat, {
        name: opts.name,
        data: opts.payload ?? null,
        opts: {
          ...(opts.priority === undefined
            ? {}
            : { priority: clampPriority(opts.priority) }),
          ...(opts.maxAttempts === undefined
            ? {}
            : { attempts: opts.maxAttempts }),
        },
      });
    },
    async unschedule(id: string): Promise<void> {
      await queue.removeJobScheduler(id);
    },
    async schedules(): Promise<ScheduledJobInfo[]> {
      const list = await queue.getJobSchedulers();
      return list.map((entry) => ({
        id: entry.key.split(ID_SEPARATOR).pop() ?? entry.key,
        name: entry.name,
        ...(entry.pattern === undefined ? {} : { pattern: entry.pattern }),
        ...(entry.every === undefined ? {} : { everyMs: entry.every }),
        ...(entry.next === undefined ? {} : { next: entry.next }),
      }));
    },
    async close(): Promise<void> {
      await Promise.all([...workers.values()].map((w) => w.close()));
      await queue.close();
    },
  };
}
