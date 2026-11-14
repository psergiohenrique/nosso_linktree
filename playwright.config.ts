import { defineConfig, devices } from "@playwright/test";

// Banco local do Docker (npm run db:up). Nunca aponta para o Neon: recusa qualquer host que não seja local.
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://linkbio:linkbio@localhost:5435/linkbio";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(E2E_DATABASE_URL)) {
  throw new Error("E2E_DATABASE_URL precisa apontar para um banco local.");
}
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 180_000,
    // Sem e-mail, PostHog nem cobrança de verdade: variáveis vazias valem mais que o .env.local.
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      APP_SECRET: "e2e-secret-not-for-production",
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      RESEND_API_KEY: "",
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "",
      NEXT_PUBLIC_POSTHOG_HOST: "",
      BILLING_ENABLED: "",
      PIX_ENABLED: "",
    },
  },
});
