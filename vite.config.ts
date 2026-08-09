// ============================================================================
// File: vite.config.ts
// Purpose: Estimator frontend – dedupe React + proxy backend (3001)
// Root vite config used by Vercel (builds from repo root).
// Points Vite at frontend-estimator/ where the actual source lives.
// ============================================================================

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // Tell Vite where index.html and src/ actually live
  root: path.resolve(__dirname, "frontend-estimator"),

  plugins: [react()],

  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./frontend-estimator/src"),
    },
  },

  build: {
    // Output to repo-root/dist so Vercel finds it at the default location
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },

  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/estimator": { target: "http://localhost:3001", changeOrigin: true },
      "/leads":      { target: "http://localhost:3001", changeOrigin: true },
      "/users":      { target: "http://localhost:3001", changeOrigin: true },
    },
  },
});
