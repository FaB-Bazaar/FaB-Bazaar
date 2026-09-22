/**
 * Printing detail page (/printing/[printing_id]) — a double-faced card must
 * offer its other face. The search payload already carries
 * other_face_image_url / other_face_name (enrichOtherFaces), and /opt + the
 * card-details lightbox render it, but the printing page's rail only ever
 * showed image_url, so Levia, Redeemed // Blasmophet (DTD164) had no way to
 * see the flip side.
 *
 * Also pins migration 0113 / the 003 face rule: Levia, Redeemed is the FRONT
 * (image DTD164), Blasmophet the back (DTD164_BACK). The feed shipped the
 * non-foil pair's flags swapped, which cross-wired Levia's page to the
 * Blasmophet art.
 *
 * Fixture-free: printing_ids are immutable PKs.
 *   TncL8B98DftCW7Crm7zpN = Levia, Redeemed (DTD164, non-foil, front)
 *   q96cLqQtQQRNftgC7Hbjh = Command and Conquer (1HP360, single-faced)
 */

import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookieConsent', 'true')
    localStorage.setItem('cookieConsentOptions', JSON.stringify({ necessary: true, analytics: false, advertising: false }))
  })
})

test('double-faced printing: flip button swaps the rail image to the other face and back', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/printing/TncL8B98DftCW7Crm7zpN')

  const railImage = page.locator('aside .card img').first()
  await expect(railImage).toHaveAttribute('src', /\/DTD164\/public$/, { timeout: 30000 })
  await expect(railImage).toHaveAttribute('alt', 'Levia, Redeemed')

  const flip = page.getByRole('button', { name: /flip to blasmophet, levia consumed/i })
  await expect(flip).toBeVisible({ timeout: 15000 })
  await expect(flip).toHaveAttribute('aria-pressed', 'false')

  await flip.click()
  await expect(railImage).toHaveAttribute('src', /\/DTD164_BACK\/public$/)
  await expect(railImage).toHaveAttribute('alt', 'Blasmophet, Levia Consumed')

  const flipBack = page.getByRole('button', { name: /flip back to levia, redeemed/i })
  await expect(flipBack).toHaveAttribute('aria-pressed', 'true')
  await flipBack.click()
  await expect(railImage).toHaveAttribute('src', /\/DTD164\/public$/)
})

test('flip state resets when another printing is picked in the selector', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/printing/TncL8B98DftCW7Crm7zpN')

  const flip = page.getByRole('button', { name: /flip to blasmophet, levia consumed/i })
  await expect(flip).toBeVisible({ timeout: 30000 })
  await flip.click()

  // Pick the English cold foil sibling — the rail must show ITS front, not a stale flipped face.
  await page.getByRole('button', { name: /cold foil/i }).first().click()
  const railImage = page.locator('aside .card img').first()
  await expect(railImage).toHaveAttribute('src', /\/DTD164-CF-AB\/public$/)
  await expect(page.getByRole('button', { name: /^flip to /i })).toHaveAttribute('aria-pressed', 'false')
})

test('single-faced printing has no flip button', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/printing/q96cLqQtQQRNftgC7Hbjh')

  await expect(page.locator('aside .card img').first()).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('button', { name: /^flip /i })).toHaveCount(0)
})
