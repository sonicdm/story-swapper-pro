import { defineConfig } from '@playwright/test';

const PORT = process.env.PLAYWRIGHT_PORT || '4173';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}/story-swapper-pro/`;
const basePath = process.env.PLAYWRIGHT_BASE_PATH
  || new URL(baseURL).pathname.replace(/^\/+|\/+$/g, '')
  || 'story-swapper-pro';

export default defineConfig({
  testDir: 'tests/browser',
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  webServer: {
    command: `node scripts/serve-dist-prefix.mjs ${basePath} ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium'
      }
    }
  ]
});
