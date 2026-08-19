import path from "path";
import { vlyPlugin } from "@vly-ai/integrations";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// VelShop — standalone Vite app (Vercel Root Directory: apps/shop, domain shop.velnox.com).
// Root is this folder; shared UI/lib/hooks come from packages/shared via the
// @velnox/shared alias, and the shared Convex API from convex/_generated.
export default defineConfig({
  root: __dirname,
  // Load env files (.env, .env.local, ...) from the monorepo root — that's
  // where Freebuff's Keys/API-keys UI writes VITE_* vars (VITE_CONVEX_URL ...).
  envDir: path.resolve(__dirname, "../.."),
  plugins: [react(), vlyPlugin(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: "@velnox/shared",
        replacement: path.resolve(__dirname, "../../packages/shared/src"),
      },
      {
        find: "@convex/_generated",
        replacement: path.resolve(__dirname, "../../convex/_generated"),
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    // Force a single copy of React (vlyPlugin can otherwise resolve its own copy).
    dedupe: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    target: "esnext",
    minify: "esbuild",
  },
  server: {
    host: true,
    port: 5173,
  },
});
