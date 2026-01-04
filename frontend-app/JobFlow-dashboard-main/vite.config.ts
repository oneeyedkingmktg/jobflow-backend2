import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
"/estimator": {
  target: process.env.VITE_API_URL,

        changeOrigin: true
      }
    }
  }
});
