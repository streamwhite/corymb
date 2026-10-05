import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { ENV_MIGRATIONS_FOLDER } from "@/constants/migrations.js";
import { resolveMigrationsFolder } from "@/db/migrations-path.js";

const originalFolder = process.env[ENV_MIGRATIONS_FOLDER];
const tempDirs: string[] = [];

afterEach(() => {
  if (originalFolder === undefined) delete process.env[ENV_MIGRATIONS_FOLDER];
  else process.env[ENV_MIGRATIONS_FOLDER] = originalFolder;
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop() as string, { recursive: true, force: true });
  }
});

function makeMigrationsDir(withJournal: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), "migrations-path-"));
  tempDirs.push(dir);
  if (withJournal) {
    mkdirSync(join(dir, "meta"), { recursive: true });
    writeFileSync(join(dir, "meta", "_journal.json"), "{}", "utf8");
  }
  return dir;
}

describe("resolveMigrationsFolder", () => {
  it("falls back to the bundled/source migrations folder with a journal", () => {
    delete process.env[ENV_MIGRATIONS_FOLDER];
    const folder = resolveMigrationsFolder();
    expect(basename(folder)).toBe("migrations");
    expect(folder).toContain("db");
  });

  it("honors MIGRATIONS_FOLDER when it contains a journal", () => {
    const dir = makeMigrationsDir(true);
    process.env[ENV_MIGRATIONS_FOLDER] = dir;
    expect(resolveMigrationsFolder()).toBe(dir);
  });

  it("ignores MIGRATIONS_FOLDER without a journal and falls back", () => {
    const dir = makeMigrationsDir(false);
    process.env[ENV_MIGRATIONS_FOLDER] = dir;
    const folder = resolveMigrationsFolder();
    expect(folder).not.toBe(dir);
    expect(basename(folder)).toBe("migrations");
  });
});
