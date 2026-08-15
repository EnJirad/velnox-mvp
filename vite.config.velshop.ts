import path from "path";
import { defineConfig, type UserConfig } from "vite";
import base from "./vite.config";

/**
 * Independent build entry for VelShop (apps/shop) — Vercel project
 * `velnox-shop`, root directory `/`, build command `bun run build:shop`.
 *
 * Keeps every setting from the shared vite.config.ts (plugins, alias,
 * manualChunks, server/hmr) and narrows the build to ONLY velshop.html so
 * each app ships its own deployable bundle.
 */
const baseConfig = base as UserConfig;

export default defineConfig({
  ...baseConfig,
  build: {
    ...baseConfig.build,
    rollupOptions: {
      ...(baseConfig.build?.rollupOptions ?? {}),
      input: { velshop: path.resolve(__dirname, "velshop.html") },
    },
  },
});
