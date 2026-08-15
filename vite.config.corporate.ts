import path from "path";
import { defineConfig, type UserConfig } from "vite";
import base from "./vite.config";

/**
 * Independent build entry for the Velnox Group corporate website
 * (apps/corporate) — Vercel project `velnox-corporate`, root directory `/`,
 * build command `bun run build:corporate`, domain velnox.com.
 *
 * Corporate is a public, content-only site (no Convex/auth/dashboards) —
 * it is NOT part of the shared multi-entry `vite build`; deploy it with this
 * config only.
 */
const baseConfig = base as UserConfig;

export default defineConfig({
  ...baseConfig,
  build: {
    ...baseConfig.build,
    rollupOptions: {
      ...(baseConfig.build?.rollupOptions ?? {}),
      input: { corporate: path.resolve(__dirname, "corporate.html") },
    },
  },
});
