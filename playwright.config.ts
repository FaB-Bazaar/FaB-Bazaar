import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    // Override when the dev server lands on another port (e.g. 3000 already taken).
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      // @mobile-tagged specs only make sense at small viewports; skip them on desktop.
      grepInvert: /@mobile/,
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] },
      grep: /@mobile/,
    },
    {
      // Opt-in cross-engine checks (tag a test @firefox). Exists because
      // Firefox never implemented :host-context(), which silently broke web
      // component dark mode there.
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } },
      grep: /@firefox/,
    },
  ],
})
