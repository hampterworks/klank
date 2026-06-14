import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  outputDir: './opt/test-results',
  reporter: [['html', { outputFolder: './opt/playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    screenshot: 'on',
    video: 'off',
    trace: 'off',
    launchOptions: {
      executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    port: 4200,
    reuseExistingServer: true,
    timeout: 60000,
  },
})
