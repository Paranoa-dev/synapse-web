import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      // Scoped to the flag system: this is a per-module coverage gate for the
      // module that gates product behaviour, not a claim about the whole repo.
      // A repo-wide number would be dominated by unmeasured UI and would only
      // reward adding trivial tests to files nobody is asking about.
      include: ["lib/flags/**"],
      // index.ts is a barrel of re-exports and types.ts is erased at compile
      // time; neither contains executable logic to cover, and leaving them in
      // reports a meaningless 0% that would have to be ignored anyway.
      exclude: ["lib/flags/index.ts", "lib/flags/types.ts", "lib/flags/**/*.test.*"],
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
    },
  },
});
