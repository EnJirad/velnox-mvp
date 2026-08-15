import path from "path";
import { defineConfig, type UserConfig } from "vite";
import base from "./vite.config";

/**
 * Independent build entry for VelCenter (apps/center) — Vercel project
 * `velnox-center`, root directory `/`, build command `bun run build:center`.
 * VelCenter ships with <meta robots=noindex> (internal app — must not be
 * indexed by search engines).
 */
const baseConfig = base as UserConfig;

export default defineConfig({
  ...baseConfig,
  build: {
    ...baseConfig.build,
    rollupOptions: {
      ...(baseConfig.build?.rollupOptions ?? {}),
      input: { velcenter: path.resolve(__dirname, "velcenter.html") },
    },
  },
});
