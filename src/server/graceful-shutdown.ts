import {
  resolveShutdownTimeoutMs,
  SHUTDOWN_TIMEOUT_EXIT_CODE,
} from "@/constants/shutdown.js";
import type { Logger } from "@/observability/logger.js";

export type ShutdownStep = { name: string; run: () => Promise<void> | void };

export type GracefulShutdownOptions = {
  logger: Logger;
  /** Steps run in order on shutdown (e.g. stop server, drain tasks, close DB). */
  steps: ShutdownStep[];
  timeoutMs?: number;
  /** Exit code to set when the deadline is exceeded. */
  timeoutExitCode?: number;
};

export type GracefulShutdown = {
  /** Runs all steps once; safe to call repeatedly (idempotent). */
  shutdown: (reason?: string) => Promise<void>;
  isShuttingDown: () => boolean;
  /** Registers SIGINT/SIGTERM handlers that trigger `shutdown`. */
  installSignalHandlers: () => void;
};

const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM"] as const;

function withTimeout<T>(task: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out after ${String(ms)}ms`)),
      ms,
    );
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Coordinates graceful shutdown: runs steps in order, each logged, within a
 * deadline. Repeated calls are ignored. Suitable for a process signal handler.
 */
export function createGracefulShutdown(
  options: GracefulShutdownOptions,
): GracefulShutdown {
  const timeoutMs = options.timeoutMs ?? resolveShutdownTimeoutMs();
  const timeoutExitCode =
    options.timeoutExitCode ?? SHUTDOWN_TIMEOUT_EXIT_CODE;
  let shuttingDown = false;

  async function runStep(step: ShutdownStep): Promise<void> {
    const started = performance.now();
    try {
      await step.run();
      options.logger.info("shutdown step done", {
        step: step.name,
        durationMs: Math.round(performance.now() - started),
      });
    } catch (err) {
      options.logger.error("shutdown step failed", {
        step: step.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function shutdown(reason?: string): Promise<void> {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    options.logger.info("shutdown started", { reason: reason ?? "manual" });
    try {
      for (const step of options.steps) {
        await runStep(step);
      }
    } finally {
      options.logger.info("shutdown complete");
    }
  }

  function installSignalHandlers(): void {
    for (const signal of SHUTDOWN_SIGNALS) {
      process.once(signal, () => {
        void withTimeout(shutdown(signal), timeoutMs)
          .then(() => {
            process.exit(0);
          })
          .catch((err: unknown) => {
            options.logger.error("shutdown deadline exceeded", {
              error: err instanceof Error ? err.message : String(err),
            });
            process.exit(timeoutExitCode);
          });
      });
    }
  }

  return {
    shutdown,
    isShuttingDown: () => shuttingDown,
    installSignalHandlers,
  };
}
