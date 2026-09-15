import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  relativeSpecifier,
  rewriteTypesPaths,
} from "../scripts/rewrite-types-paths.js";

describe("rewrite-types-paths", () => {
  it("rewrites @/ to relative paths for both from and inline import types", async () => {
    const dir = mkdtempSync(join(tmpdir(), "types-rewrite-"));
    const typesRoot = join(dir, "dist", "types");
    const authDir = join(typesRoot, "auth");
    mkdirSync(authDir, { recursive: true });
    writeFileSync(
      join(typesRoot, "index.d.ts"),
      'export { createApp } from "@/app.js";\n',
    );
    writeFileSync(
      join(authDir, "better-auth.d.ts"),
      'import("@/auth/secondary-storage.js").SecondaryStorage;\n',
    );

    rewriteTypesPaths(typesRoot);

    const indexDts = readFileSync(join(typesRoot, "index.d.ts"), "utf8");
    const betterAuthDts = readFileSync(join(authDir, "better-auth.d.ts"), "utf8");
    expect(indexDts).toBe('export { createApp } from "./app.js";\n');
    expect(betterAuthDts).toContain('import("./secondary-storage.js")');
  });

  it("computes a relative specifier with a ./ prefix", () => {
    expect(
      relativeSpecifier("@/app.js", join("dist", "types", "index.d.ts")),
    ).toBe("./app.js");
  });
});
