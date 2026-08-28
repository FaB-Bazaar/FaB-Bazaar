/**
 * Deck "Export image" — More menu → renders the deck as a shareable PNG in a
 * preview dialog with Download (and Share where the browser supports files).
 *
 * Pins:
 *  1. Desktop: More → "Export image" opens the dialog, a preview <img> renders
 *     from a real canvas (naturalWidth > 0), and Download saves a .png.
 *  2. "Include inventory" re-renders the preview.
 *  3. Mobile (@mobile): the "Deck actions" sheet exposes the same item.
 */

import { test, expect, type Page } from '@playwright/test'

test.use({ storageState: 'e2e/auth.json' })


// Teklovossen – Calling: Memphis 5th (Bridges) — system deck, public, has a 12-card inventory
const DECK_ID = 'rcyIxCBRupGZAEymikIjH'

async function gotoDeck(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('cookieConsent', 'true')
    localStorage.setItem('cookieConsentOptions', JSON.stringify({ analytics: false }))
  })
  await page.goto(`/decks/${DECK_ID}`)
  await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 20000 })
}

async function expectPreviewRendered(page: Page) {
  const dialog = page.getByRole('dialog', { name: /export image/i })
  await expect(dialog).toBeVisible()
  const preview = dialog.locator('img[alt="Deck image preview"]')
  await expect(preview).toBeVisible({ timeout: 45000 })
  await expect.poll(async () => preview.evaluate(el => (el as HTMLImageElement).naturalWidth), { timeout: 10000 }).toBeGreaterThan(1000)
  return { dialog, preview }
}

test('desktop: More → Export image renders a preview and downloads a PNG', async ({ page }) => {
  test.setTimeout(90_000)
  await gotoDeck(page)
  await page.getByRole('button', { name: /more actions/i }).click()
  await page.getByRole('menuitem', { name: /export image/i }).click()

  const { dialog, preview } = await expectPreviewRendered(page)
  const beforeSrc = await preview.getAttribute('src')

  const downloadPromise = page.waitForEvent('download')
  await dialog.getByRole('button', { name: /download/i }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.png$/)

  // Toggling inventory re-renders (new blob URL).
  await dialog.getByLabel(/include inventory/i).click()
  await expect.poll(async () => preview.getAttribute('src'), { timeout: 45000 }).not.toBe(beforeSrc)
})

test('@mobile: deck actions sheet exposes Export image and renders the preview', async ({ page }) => {
  test.setTimeout(90_000)
  await gotoDeck(page)
  await page.getByRole('button', { name: /deck actions/i }).click()
  await page.getByRole('button', { name: /export image/i }).click()
  await expectPreviewRendered(page)
})
