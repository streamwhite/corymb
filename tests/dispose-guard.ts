import { afterEach } from "bun:test";
import { resetRateLimitStateForTests } from "@/http/rate-limit.js";

const pending: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(pending.splice(0).map((d) => d()));
  resetRateLimitStateForTests();
});

export function scheduleTestDispose(dispose: () => Promise<void>): void {
  pending.push(dispose);
}
