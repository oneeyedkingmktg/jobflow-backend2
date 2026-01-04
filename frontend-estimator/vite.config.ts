// ============================================================================
// File: vite.config.ts
// Purpose: Estimator frontend – dedupe React + proxy backend (3001)
// ============================================================================

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  resolve: {
    // Prevent multiple React instances (fix hooks)
    dedupe: ["react", "react-dom"],

    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    port: 5173,
    strictPort: true,

    // Proxy backend API requests to local backend
proxy: {
  "/estimator": {
    target: process.env.VITE_API_URL,
    changeOrigin: true,
  },
  "/leads": {
    target: process.env.VITE_API_URL,
    changeOrigin: true,
  },
  "/users": {
    target: process.env.VITE_API_URL,
    changeOrigin: true,
  },
},

    },
  },
});
