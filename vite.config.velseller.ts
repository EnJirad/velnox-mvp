import path from "path";
import { defineConfig, type UserConfig } from "vite";
import base from "./vite.config";

/**
 * Independent build entry for VelSeller (apps/seller) — Vercel project
 * `velnox-seller`, root directory `/`, build command `bun run build:seller`.
 */
const baseConfig = base as UserConfig;

export default defineConfig({
  ...baseConfig,
  build: {
    ...baseConfig.build,
    rollupOptions: {
      ...(baseConfig.build?.rollupOptions ?? {}),
      input: { velseller: path.resolve(__dirname, "velseller.html") },
    },
  },
});
