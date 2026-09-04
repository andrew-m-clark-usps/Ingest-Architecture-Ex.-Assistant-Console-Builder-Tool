import { defineConfig, devices } from '@playwright/test'

const useManualServer = process.env.PLAYWRIGHT_MANUAL_SERVER === '1'

// See ../Console.md section 5 (quality gates): npm run smoke covers
// grids/exports/access model/metering/theme with zero console errors.
// Runs against the production build (vite preview), not the dev server,
// so this exercises the same bundle the "check:dist" grep checks.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    // Drives the system-installed Chrome rather than Playwright's own
    // bundled Chromium download -- GitHub-hosted Actions runners ship
    // Chrome stable preinstalled, so this avoids a browser-binary
    // download step (and the network restrictions that can block one)
    // both here and in CI.
    channel: 'chrome',
  },
  webServer: useManualServer
    ? undefined
    : {
        command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
