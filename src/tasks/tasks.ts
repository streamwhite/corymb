import type { Logger } from "@/observability/logger.js";
import { createTaskQueue } from "@/tasks/task-queue.js";
import type {
  EnqueueOptions,
  ScheduleOptions,
  TaskHandler,
  TaskQueue,
  TaskQueueOptions,
} from "@/tasks/task-types.js";

/** App-bound BullMQ queue plus convenience helpers. */
export type Tasks = {
  queue: TaskQueue;
  /** Register a handler (once) and enqueue a job, returning the job id. */
  run: <T = unknown>(
    name: string,
    handler: TaskHandler<T>,
    payload?: T,
    options?: Omit<EnqueueOptions, "name" | "payload">,
  ) => Promise<string>;
  /** Register a handler and schedule it (cron/interval). */
  schedule: <T = unknown>(
    name: string,
    handler: TaskHandler<T>,
    options: ScheduleOptions,
  ) => Promise<void>;
};

function ensureRegistered(
  queue: TaskQueue,
  registered: Set<string>,
  name: string,
  handler: TaskHandler<never>,
): void {
  if (registered.has(name)) return;
  queue.register(name, handler);
  registered.add(name);
}

/** Wraps an existing queue (e.g. a noop queue) with register-and-run helpers. */
export function createTasksFromQueue(queue: TaskQueue): Tasks {
  const registered = new Set<string>();
  return {
    queue,
    run(name, handler, payload, options): Promise<string> {
      ensureRegistered(queue, registered, name, handler as TaskHandler<never>);
      return queue.enqueue({ name, payload, ...options });
    },
    schedule(name, handler, options): Promise<void> {
      ensureRegistered(queue, registered, name, handler as TaskHandler<never>);
      return queue.schedule({ ...options, name });
    },
  };
}

export function createTasks(
  options: TaskQueueOptions,
  logger: Logger,
): Tasks {
  return createTasksFromQueue(createTaskQueue(options, { logger }));
}
