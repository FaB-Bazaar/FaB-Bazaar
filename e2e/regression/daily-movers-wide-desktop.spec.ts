/**
 * /daily uses the available width on wide desktops.
 *
 * Regression: the page wrapper was `container max-w-6xl` (1152px), leaving
 * ~40% of a 1920px viewport empty while the navbar ran to 1400px. The wrapper
 * is now fluid up to 1800px and the market grid gains a 5-column tier at 2xl.
 */

import { test, expect } from '@playwright/test'

test.use({
  viewport: { width: 1920, height: 1080 },
  storageState: { cookies: [], origins: [] },
})

test('page wrapper is wider than the old 1152px cap at 1920px', async ({ page }) => {
  await page.goto('/daily')
  const heading = page.getByRole('heading', { name: 'Daily Movers' })
  await expect(heading).toBeVisible()

  // The wrapper is the ancestor with horizontal padding that holds the h1
  const width = await heading.evaluate((h1) => {
    const wrapper = h1.parentElement!.parentElement!
    return wrapper.getBoundingClientRect().width
  })
  expect(width).toBeGreaterThan(1500)
  expect(width).toBeLessThanOrEqual(1800)
})

test('market grid renders five columns at 1920px', async ({ page }) => {
  await page.goto('/daily')
  await expect(page.getByRole('heading', { name: 'Around the market' })).toBeVisible()

  const grid = page.locator('.grid').filter({ has: page.locator('a[href^="/printing/"]') }).first()
  const cols = await grid.evaluate((el) =>
    getComputedStyle(el).gridTemplateColumns.split(' ').length
  )
  expect(cols).toBe(5)
})
