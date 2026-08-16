import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Velnox Corporate — standalone Vite app (Vercel Root Directory: apps/corporate, domain velnox.com).
// Public, content-only company site: no Convex client, no auth.
export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: "@velnox/shared",
        replacement: path.resolve(__dirname, "../../packages/shared/src"),
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
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
