import { defineConfig } from "vitest/config";

// Vitest runs the repo's unit tests (tests/).
// `velnox-mvp/` is a deployable snapshot of the project — its copied tests are
// not part of the root test suite (they'd resolve against the snapshot's own
// relative paths and double-run).
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/velnox-mvp/**", "**/.git/**"],
  },
});
