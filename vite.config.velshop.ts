import path from "path";
import { defineConfig, type UserConfig } from "vite";
import base from "./vite.config";

/**
 * Independent build entry for VelShop (apps/shop) — Vercel project
 * `velnox-shop`. Used two ways:
 *   1. from the repo root: `bun run build:shop` (Vercel Root Directory `/`), and
 *   2. from apps/shop/vite.config.ts (Vercel Root Directory `apps/shop`), which
 *      reuses this config and only re-anchors `root`/`outDir`.
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
