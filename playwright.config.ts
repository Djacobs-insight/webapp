import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'pnpm dev --port 3001',
    url: process.env.BASE_URL || 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
