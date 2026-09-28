import { describe, expect, it } from "bun:test";
import {
  AbortError,
  abortRetry,
  retryOperation,
} from "@/tasks/retry.js";

const fastOptions = { minTimeoutMs: 1, maxTimeoutMs: 2 };

describe("retryOperation", () => {
  it("returns the result without retrying on success", async () => {
    let calls = 0;
    const result = await retryOperation(async () => {
      calls += 1;
      return "ok";
    });
    expect(result).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries until the operation succeeds with increasing attempts", async () => {
    const attempts: number[] = [];
    const result = await retryOperation(
      async (attempt) => {
        attempts.push(attempt);
        if (attempt < 3) throw new Error("transient");
        return attempt;
      },
      { ...fastOptions, retries: 5 },
    );
    expect(result).toBe(3);
    expect(attempts).toEqual([1, 2, 3]);
  });

  it("rejects with the last error once retries are exhausted", async () => {
    let calls = 0;
    const promise = retryOperation(
      async () => {
        calls += 1;
        throw new Error(`fail-${calls}`);
      },
      { ...fastOptions, retries: 2 },
    );
    await expect(promise).rejects.toThrow("fail-3");
    expect(calls).toBe(3);
  });

  it("aborts immediately when the operation uses abortRetry", async () => {
    let calls = 0;
    const promise = retryOperation(
      async () => {
        calls += 1;
        throw abortRetry("stop");
      },
      { ...fastOptions, retries: 5 },
    );
    await expect(promise).rejects.toBeInstanceOf(AbortError);
    expect(calls).toBe(1);
  });

  it("stops retrying when shouldRetry returns false", async () => {
    let calls = 0;
    const promise = retryOperation(
      async () => {
        calls += 1;
        throw new Error("fatal");
      },
      { ...fastOptions, retries: 5, shouldRetry: () => false },
    );
    await expect(promise).rejects.toThrow("fatal");
    expect(calls).toBe(1);
  });

  it("reports failed attempts with the remaining retries", async () => {
    const failures: number[] = [];
    await retryOperation(
      async (attempt) => {
        if (attempt < 2) throw new Error("transient");
        return attempt;
      },
      {
        ...fastOptions,
        retries: 2,
        onFailedAttempt: ({ retriesLeft }) => {
          failures.push(retriesLeft);
        },
      },
    );
    expect(failures).toEqual([2]);
  });
});
