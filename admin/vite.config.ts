import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Em desenvolvimento, /v1 é reencaminhado para a API (por omissão a local, porta 3000;
 * ou a do Render com VITE_DEV_API_TARGET). Em produção, quem reencaminha é a Vercel (vercel.json).
 */
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/v1": {
        target: process.env["VITE_DEV_API_TARGET"] ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: { sourcemap: mode !== "production" },
}));
