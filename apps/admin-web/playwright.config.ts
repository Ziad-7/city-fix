import { defineConfig, devices } from '@playwright/test';

const API_PORT = 8020;
const WEB_PORT = 3120;
const API_URL = `http://localhost:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: WEB_URL,
    locale: 'ar-EG',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `node -e "require('fs').rmSync('_e2e.db',{force:true})" && cd ../../backend && node -e "require('fs').rmSync('_e2e.db',{force:true})" && uv run uvicorn app.main:app --port ${API_PORT}`,
      url: `${API_URL}/docs`,
      cwd: __dirname,
      env: { DATABASE_URL: 'sqlite:///./_e2e.db', SEED_ON_START: 'true', DEMO_RESET_ENABLED: 'true' },
      reuseExistingServer: !!process.env.CI,
      timeout: 120_000,
    },
    {
      // Dev server locally; on CI a production build (NEXT_PUBLIC_API_URL is inlined at build time).
      command: process.env.CI
        ? `npx next build && npx next start -p ${WEB_PORT}`
        : `npx next dev -p ${WEB_PORT}`,
      url: `${WEB_URL}/login`,
      cwd: __dirname,
      env: { NEXT_PUBLIC_API_URL: API_URL },
      reuseExistingServer: !!process.env.CI,
      timeout: 180_000,
    },
  ],
});
