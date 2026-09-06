/**
 * Card-details lightbox (shared by /opt, deck tiles and QuickAdd) — on
 * desktop the TCGplayer purchase link must be visible WITHOUT scrolling the
 * details panel, however many printings the card has. Before the fix the link
 * was the last child inside the panel's scroll area, so a card with 4+
 * printing rows pushed it below the fold and nothing signalled that the panel
 * scrolled (Spark of Genius / Nitro Mechanoid on the deck page).
 *
 * Fixture-free: Command and Conquer has 11 English printings locally, the
 * longest printings list in the DB.
 */

import { test, expect, type Locator } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 800 } })

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('element has no bounding box')
  return b
}

test('purchase link is visible without scrolling and stays pinned while printings scroll', async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => {
    localStorage.setItem('cookieConsent', 'true')
    localStorage.setItem('cookieConsentOptions', JSON.stringify({ necessary: true, analytics: false, advertising: false }))
  })
  await page.goto('/opt?q=command%20and%20conquer')
  await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 15000 })

  const expand = page.getByRole('button', { name: /preview command and conquer/i }).first()
  await expect(expand).toBeAttached({ timeout: 15000 })
  await expand.click({ force: true })

  const lightbox = page.getByTestId('card-lightbox')
  await expect(lightbox).toBeVisible({ timeout: 5000 })
  const details = lightbox.getByTestId('card-lightbox-details')
  const printings = details.getByRole('list', { name: /^printings$/i })
  await expect(printings).toBeVisible({ timeout: 15000 })
  expect(await printings.getByRole('listitem').count()).toBeGreaterThanOrEqual(6)

  const link = details.getByRole('link', { name: /available for purchase here/i })
  const panel = await box(details)
  const title = await box(details.getByText('Command and Conquer').first())

  await test.step('link and title are both inside the panel before any scroll', async () => {
    const l = await box(link)
    expect(l.y + l.height).toBeLessThanOrEqual(panel.y + panel.height + 1)
    expect(l.y).toBeGreaterThanOrEqual(panel.y - 1)
    expect(l.y + l.height).toBeLessThanOrEqual(800)
    expect(title.y).toBeGreaterThanOrEqual(panel.y - 1)
  })

  await test.step('scrolling the printings list into view does not move the link', async () => {
    const before = await box(link)
    await printings.getByRole('listitem').last().scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
    const after = await box(link)
    expect(Math.abs(after.y - before.y)).toBeLessThan(1)
    // the last printing row is now visible inside the panel too
    const last = await box(printings.getByRole('listitem').last())
    expect(last.y + last.height).toBeLessThanOrEqual(before.y + 1)
  })
})

test('double-faced card at 1440px keeps the panel at full width and the row inside the viewport', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => {
    localStorage.setItem('cookieConsent', 'true')
    localStorage.setItem('cookieConsentOptions', JSON.stringify({ necessary: true, analytics: false, advertising: false }))
  })
  await page.goto('/opt?q=construct%20nitro%20mechanoid')
  await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 15000 })
  const expand = page.getByRole('button', { name: /preview construct nitro mechanoid/i }).first()
  await expect(expand).toBeAttached({ timeout: 15000 })
  await expand.click({ force: true })

  const lightbox = page.getByTestId('card-lightbox')
  await expect(lightbox.getByRole('img', { name: /^Nitro Mechanoid$/ })).toBeVisible({ timeout: 10000 })
  const details = lightbox.getByTestId('card-lightbox-details')
  await expect(details.getByRole('list', { name: /^printings$/i })).toBeVisible({ timeout: 15000 })

  const panel = await box(details)
  expect(panel.width).toBeGreaterThanOrEqual(400)
  const dialog = await box(lightbox.getByRole('dialog'))
  expect(dialog.x).toBeGreaterThanOrEqual(0)
  expect(dialog.x + dialog.width).toBeLessThanOrEqual(1440)
})
