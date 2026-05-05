import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'APP_'],
  optimizeDeps: {
    exclude: ['android', 'ios'],
  },
  server: {
    proxy: {
"/estimator": {
  target: process.env.VITE_API_URL,

        changeOrigin: true
      }
    }
  }
});
