import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Test Configuration for ChatKut
 *
 * Tests the full E2E workflow:
 * - Project creation
 * - Video upload (TUS to Cloudflare)
 * - AI chat editing
 * - Disambiguator UI
 * - Render workflow
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Maximum time one test can run for
  timeout: 60 * 1000,

  // Run tests in files in parallel
  fullyParallel: false, // Sequential for now due to shared state

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : 1, // Single worker for consistent state

  // Reporter to use
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],

  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:3001',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Viewport size
    viewport: { width: 1280, height: 720 },
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Assuming dev servers are already running
  // webServer: [
  //   {
  //     command: 'npx convex dev',
  //     url: 'http://localhost:3210', // Convex dev server
  //     timeout: 120 * 1000,
  //     reuseExistingServer: !process.env.CI,
  //     stdout: 'pipe',
  //     stderr: 'pipe',
  //   },
  //   {
  //     command: 'npm run dev',
  //     url: 'http://localhost:3001',
  //     timeout: 120 * 1000,
  //     reuseExistingServer: !process.env.CI,
  //     stdout: 'pipe',
  //     stderr: 'pipe',
  //   },
  // ],
});
