import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/**
 * O dashboard (/app) é uma página própria, com o seu CSS, para não colidir com o CSS
 * das páginas de acesso. Em desenvolvimento e na pré-visualização, qualquer endereço
 * /app/... sem ficheiro correspondente serve app/index.html (na Vercel faz-se em vercel.json).
 */
function dashboardFallback(): Plugin {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    const url = req.url ?? "";
    const path = url.split("?")[0] ?? "";
    if ((path === "/app" || path.startsWith("/app/")) && !/\.[a-z0-9]+$/i.test(path)) {
      req.url = "/app/index.html";
    }
    next();
  };
  return {
    name: "kivora-dashboard-fallback",
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), dashboardFallback()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        app: fileURLToPath(new URL("./app/index.html", import.meta.url)),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
