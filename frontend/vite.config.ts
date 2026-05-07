/// <reference types="node" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/v1": {
          target: env.VITE_ORCHESTRATOR_URL ?? "http://localhost:3001",
          changeOrigin: true,
        },
        // Mantém /api funcional caso ainda existam chamadas legacy.
        "/api": {
          target: env.VITE_LEGACY_API_URL ?? "http://localhost:9015",
          changeOrigin: true,
        },
      },
    },
  };
});
