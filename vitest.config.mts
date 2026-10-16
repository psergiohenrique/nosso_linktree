import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` lança erro fora do Next; nos testes vira um módulo vazio.
      "server-only": path.resolve(import.meta.dirname, "test/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Testes com banco só rodam com TEST_DATABASE_URL (nunca usam o DATABASE_URL do .env.local).
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "", APP_SECRET: "segredo-de-teste" },
  },
});
