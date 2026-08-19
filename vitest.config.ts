import { defineConfig } from "vitest/config";

// Vitest runs the repo's unit tests (tests/) plus in-repo test files.
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
  },
});
