import path from "path";
import { vlyPlugin } from "@vly-ai/integrations";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// VelSeller — standalone Vite app (Vercel Root Directory: apps/seller, domain seller.velnox.com).
export default defineConfig({
  root: __dirname,
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
