import { afterEach } from "bun:test";

const pending: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(pending.splice(0).map((d) => d()));
});

export function scheduleTestDispose(dispose: () => Promise<void>): void {
  pending.push(dispose);
}
