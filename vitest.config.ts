import path from "node:path";
import { defineConfig } from "vitest/config";

const ROOT = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(ROOT, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
