/**
 * FeaturedCardsCarousel only attaches the auto-scroll plugin when there are
 * more than 5 cards, but used to call play() on it unconditionally (after the
 * images load, after a drag, when a who-has dropdown closed). On a small
 * carousel the plugin was never initialised, so each call threw
 * "Cannot read properties of undefined (reading 'emit')".
 * Fixture: local "Levia's Combat Mathematics" hero article (small carousels).
 */
import { test, expect } from '@playwright/test'

test('an article with small card carousels loads without page errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/heroes/1zKDgRhu7j')
  await expect(page.locator('fab-spotlight-card').first()).toBeAttached({ timeout: 60000 })
  await page.waitForTimeout(3000) // carousel images load, then play() used to fire
  expect(errors).toEqual([])
})
