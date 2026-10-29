import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * @kivora/shared é lido directamente de packages/shared/src (só tipos e constantes),
 * sem dependência de workspace, para o admin não exigir alterações ao pnpm-lock.yaml.
 * Em desenvolvimento, /v1 é reencaminhado para a API (local, ou VITE_DEV_API_TARGET).
 */
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@kivora/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/v1": { target: process.env["VITE_DEV_API_TARGET"] ?? "http://localhost:3000", changeOrigin: true },
    },
  },
  build: { sourcemap: mode !== "production" },
}));
