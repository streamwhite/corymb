import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import path from "path";

const PKG_PATH = path.join(import.meta.dir, "..", "package.json");

function readPackageJson(): Record<string, unknown> {
  return JSON.parse(readFileSync(PKG_PATH, "utf8")) as Record<string, unknown>;
}

describe("package publish contract", () => {
  const pkg = readPackageJson();

  it("is publishable (no private flag)", () => {
    expect(pkg.private).toBeUndefined();
  });

  it("has the expected name", () => {
    expect(pkg.name).toBe("bun-backend-starter");
  });

  it("exposes a runtime entry and type declarations", () => {
    expect(pkg.main).toBe("./dist/index.js");
    expect(pkg.types).toBe("./dist/types/index.d.ts");
  });

  it("maps the package root to the bundled library", () => {
    const exports = pkg.exports as Record<string, { types?: string; import?: string }>;
    expect(exports["."].types).toBe("./dist/types/index.d.ts");
    expect(exports["."].import).toBe("./dist/index.js");
  });

  it("declares the server CLI as the bin", () => {
    const bin = pkg.bin as Record<string, string>;
    expect(bin["bun-backend-starter"]).toBe("./dist/cli.js");
  });

  it("ships dist, docs, and env example", () => {
    const files = pkg.files as string[];
    expect(files).toContain("dist");
    expect(files).toContain("docs");
    expect(files).toContain(".env.example");
    expect(files).toContain("README.md");
    expect(files).toContain("LICENSE");
  });

  it("requires Bun at runtime", () => {
    const engines = pkg.engines as Record<string, string>;
    expect(engines.bun).toBeDefined();
  });

  it("builds before publishing", () => {
    const scripts = pkg.scripts as Record<string, string>;
    expect(scripts.prepack).toContain("bun run build");
  });
});
