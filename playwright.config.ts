import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * 
 * Run: npx playwright test
 * Debug: npx playwright test --debug
 * UI Mode: npx playwright test --ui
 */

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  
  // Global timeout for tests
  timeout: 30000,

  // Expected conditions timeout
  expect: {
    timeout: 5000,
  },

  // Fail on console.error
  use: {
    // Base URL for navigation
    baseURL: 'http://localhost:5000',
    
    // Trace failed tests
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Collect videos on failure
    video: 'retain-on-failure',
  },

  // Run tests in files
  workers: 1, // Single worker for consistency

  // Reporter configuration
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'junit.xml' }],
  ],

  // Retry failed tests
  retries: 2,

  // Projects (browsers)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Web server configuration
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
