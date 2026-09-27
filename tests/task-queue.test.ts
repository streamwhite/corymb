import { afterAll, describe, expect, it } from "bun:test";
import { createLogger } from "@/observability/logger.js";
import { createTaskQueue } from "@/tasks/task-queue.js";
import type { TaskFailure } from "@/tasks/task-types.js";
import { REDIS_AVAILABLE, getTestRedisUrl, stopTestRedis } from "./helpers/test-redis.js";

function silentLogger() {
  return createLogger({ service: "test" }, { level: "error", writer: () => {} });
}

function uniqueQueue(): string {
  return `tasks-${crypto.randomUUID()}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterAll(async () => {
  await stopTestRedis();
});

describe.skipIf(!REDIS_AVAILABLE)("task queue (bullmq + redis)", () => {
  async function withQueue(
    options: Parameters<typeof createTaskQueue>[0],
    fn: (queue: ReturnType<typeof createTaskQueue>, name: string) => Promise<void>,
  ): Promise<void> {
    const name = uniqueQueue();
    const queue = createTaskQueue(
      { redisUrl: await getTestRedisUrl(), name, ...options },
      { logger: silentLogger() },
    );
    try {
      await fn(queue, name);
    } finally {
      await queue.close();
    }
  }

  it("runs a registered handler and completes the job", async () => {
    const seen: number[] = [];
    await withQueue({}, async (queue) => {
      queue.register<number>("double", (n) => {
        seen.push(n * 2);
      });
      await queue.enqueue({ name: "double", payload: 21 });
      await waitFor(() => seen.length === 1);
      expect(seen).toEqual([42]);
      expect(await queue.counts()).toMatchObject({ completed: 1, failed: 0 });
    });
  });

  it("retries with backoff until success", async () => {
    let attempts = 0;
    await withQueue({ maxAttempts: 3, backoffMs: 10 }, async (queue) => {
      queue.register("flaky", () => {
        attempts += 1;
        if (attempts < 3) throw new Error("nope");
      });
      await queue.enqueue({ name: "flaky" });
      await waitFor(() => attempts >= 3);
      expect(await queue.counts()).toMatchObject({ completed: 1, failed: 0 });
    });
  });

  it("dead-letters a job after exhausting attempts", async () => {
    const failures: TaskFailure[] = [];
    await withQueue(
      { maxAttempts: 2, backoffMs: 10, onDeadLetter: (f) => void failures.push(f) },
      async (queue) => {
        queue.register("always-fails", () => {
          throw new Error("boom");
        });
        await queue.enqueue({ name: "always-fails", payload: { id: 7 } });
        await waitFor(() => failures.length === 1);
        expect(failures[0]?.error.message).toBe("boom");
        expect(await queue.counts()).toMatchObject({ failed: 1 });
      },
    );
  });

  it("supports delayed jobs", async () => {
    const seen: string[] = [];
    await withQueue({}, async (queue) => {
      queue.register("later", () => {
        seen.push("done");
      });
      await queue.enqueue({ name: "later", delayMs: 30 });
      expect(seen).toEqual([]);
      await waitFor(() => seen.length === 1, 2000);
    });
  });

  it("registers and enqueues via tasks.run", async () => {
    const { createTasks } = await import("@/tasks/tasks.js");
    const name = uniqueQueue();
    const tasks = createTasks(
      { redisUrl: await getTestRedisUrl(), name },
      silentLogger(),
    );
    try {
      const seen: string[] = [];
      await tasks.run("greet", async () => {
        seen.push("hi");
      });
      await waitFor(() => seen.length === 1);
      expect(seen).toEqual(["hi"]);
    } finally {
      await tasks.queue.close();
    }
  });
});

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 5000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(20);
  }
  if (!predicate()) {
    throw new Error("condition not met before timeout");
  }
}
