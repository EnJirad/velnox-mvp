import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type UserConfig } from "vite";
import shopConfig from "../../vite.config.velshop";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, "../..");

/**
 * VelShop deployable build config — used when Vercel deploys with
 * Root Directory = `apps/shop` (workspace project `velnox-shop`).
 *
 * The real VelShop source is NOT copied here: per the documented repo
 * architecture (docs/RESTRUCTURE_INVENTORY.md §16, apps/README.md) all four
 * sites share one source tree at the repo root (src/, src/convex/, public/)
 * with one Convex backend + one Neon database. This config reuses the root
 * `vite.config.velshop.ts` (which pins the velshop.html entry, the `@/` alias
 * and the shared plugins) and only re-anchors the build:
 *   - `root` -> repo root, so the velshop.html entry, shared src/ and the
 *     public/ assets (logo, manifest, robots.txt, sitemap) resolve exactly as
 *     they do in the root multi-entry build;
 *   - `outDir` -> apps/shop/dist, the output this Vercel project serves.
 */
export default defineConfig({
  ...(shopConfig as UserConfig),
  root: repoRoot,
  build: {
    ...((shopConfig as UserConfig).build ?? {}),
    outDir: path.resolve(dirname, "dist"),
    emptyOutDir: true,
  },
});
