import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");

describe("Docker packaging artifacts", () => {
  test("compose.yaml exists", async () => {
    expect(await Bun.file(join(REPO_ROOT, "compose.yaml")).exists()).toBe(true);
  });

  test("Dockerfile exists", async () => {
    expect(await Bun.file(join(REPO_ROOT, "Dockerfile")).exists()).toBe(true);
  });

  test("docker env example documents JWT_SECRET", async () => {
    const path = join(REPO_ROOT, "docker/env.example");
    const raw = await Bun.file(path).text();
    expect(raw).toContain("JWT_SECRET");
  });
});
