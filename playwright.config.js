const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://192.168.12.219:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        // Override to use our mobile URL
        baseURL: 'http://192.168.12.219:3001'
      },
    },
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        // Override to use our mobile URL  
        baseURL: 'http://192.168.12.219:3001'
      },
    },
    {
      name: 'Desktop Chrome',
      use: { 
        ...devices['Desktop Chrome'],
        // Test desktop version too
        baseURL: 'http://localhost:3001'
      },
    },
  ],

  webServer: [
    {
      command: 'yarn dev',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});