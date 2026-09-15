import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  CLI_FORCE_FLAG,
  initProject,
  PACKAGE_NAME,
} from "@/scaffold/init-project.js";

describe("initProject scaffolder", () => {
  it("writes package.json, env, sample entry, and README", () => {
    const dir = mkdtempSync(join(tmpdir(), "ba-init-"));
    const result = initProject({ targetDir: dir });

    expect(result.filesWritten).toContain("package.json");
    expect(result.filesWritten).toContain(".env");
    expect(result.filesWritten).toContain("src/index.ts");
    expect(result.filesWritten).toContain("README.md");

    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
      type: string;
    };
    expect(pkg.type).toBe("module");
    expect(pkg.dependencies[PACKAGE_NAME]).toBeDefined();

    const index = readFileSync(join(dir, "src/index.ts"), "utf8");
    expect(index).toContain("startServer");
    expect(index).toContain("publishRealtimeEvent");
    expect(index).toContain("/api/hello");
    expect(existsSync(join(dir, ".env.example"))).toBe(true);
  });

  it("refuses non-empty directories without --force", () => {
    const dir = mkdtempSync(join(tmpdir(), "ba-init-full-"));
    writeFileSync(join(dir, "keep.txt"), "x", "utf8");
    expect(() => initProject({ targetDir: dir })).toThrow(/non-empty/);
    expect(() => initProject({ targetDir: dir })).toThrow(CLI_FORCE_FLAG);
  });

  it("overwrites when force is set", () => {
    const dir = mkdtempSync(join(tmpdir(), "ba-init-force-"));
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "keep.txt"), "x", "utf8");
    const result = initProject({ targetDir: dir, force: true });
    expect(result.filesWritten.length).toBeGreaterThan(0);
    expect(existsSync(join(dir, "src/index.ts"))).toBe(true);
  });
});
