/**
 * Presenter page mobile regressions — /decks/[id]/present
 *
 * Pins the mobile fixes:
 *  1. Narrow viewports default to the SCROLL view (fit view clips lanes on phones).
 *  2. Desktop keeps the fit-view default.
 *  3. Scroll view reserves bottom padding so the last card row clears the
 *     floating MobileTabBar (`nav[aria-label="Primary"]`, <sm only).
 *  4. The three floating top pills (Back / Draw / view toggle) don't overlap
 *     at phone width in fit view.
 *  5. Spotlight prev/next arrows sit ABOVE the panel (clickable without force),
 *     and the view-toggle pill hides while the spotlight is open so the
 *     close X isn't buried underneath it.
 */

import { test, expect, type Page } from '@playwright/test'

test.use({ storageState: 'e2e/auth.json' })

// 🇹🇭 Enigma – Tobias Schmiedeberg (system deck, public, 55 cards, equipment + red/blue/no-pitch)
const DECK_ID = 'WYuz7ZpvN_02yM1Bvx66K'

const MOBILE = { width: 390, height: 844 }

async function gotoPresenter(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('cookieConsent', 'true')
    localStorage.setItem('cookieConsentOptions', JSON.stringify({ analytics: false }))
  })
  await page.goto(`/decks/${DECK_ID}/present`)
  await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 15000 })
}

function viewToggle(page: Page) {
  // The toggle's label names the mode you'd switch TO.
  return page.getByRole('button', { name: /scroll view|fit to screen/i })
}

async function ensureMode(page: Page, mode: 'scroll' | 'fit') {
  const toggle = viewToggle(page)
  await expect(toggle).toBeVisible({ timeout: 10000 })
  const label = (await toggle.textContent()) ?? ''
  const current = /scroll view/i.test(label) ? 'fit' : 'scroll'
  if (current !== mode) await toggle.click()
}

test.describe('mobile viewport', () => {
  test.use({ viewport: MOBILE })

  test('defaults to the scroll view on a phone', async ({ page }) => {
    test.setTimeout(60_000)
    await gotoPresenter(page)
    // Toggle offers "Fit to screen" → current mode is scroll
    await expect(viewToggle(page)).toHaveAccessibleName(/fit to screen/i, { timeout: 10000 })
    // Scroll view renders full section headings (fit view strips "Library — ")
    await expect(page.getByRole('heading', { name: /Library — Red/i })).toBeVisible()
  })

  test('scroll view clears the mobile tab bar at the bottom of the page', async ({ page }) => {
    test.setTimeout(60_000)
    await gotoPresenter(page)
    await ensureMode(page, 'scroll')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)

    const tabBar = page.locator('nav[aria-label="Primary"]')
    await expect(tabBar).toBeVisible()
    const navBox = await tabBar.boundingBox()
    const lastTile = page.locator('button[title*="×"]').last()
    const tileBox = await lastTile.boundingBox()
    expect(navBox).not.toBeNull()
    expect(tileBox).not.toBeNull()
    // Fully scrolled: the last card must sit above the floating tab bar.
    expect(tileBox!.y + tileBox!.height).toBeLessThanOrEqual(navBox!.y)
  })

  test('fit view top pills do not overlap at phone width', async ({ page }) => {
    test.setTimeout(60_000)
    await gotoPresenter(page)
    await ensureMode(page, 'fit')

    const back = page.getByRole('link', { name: /back/i })
    const draw = page.getByRole('button', { name: /draw/i })
    const toggle = viewToggle(page)
    await expect(back).toBeVisible()
    await expect(draw).toBeVisible()
    await expect(toggle).toBeVisible()

    const boxes = []
    for (const loc of [back, draw, toggle]) {
      const b = await loc.boundingBox()
      expect(b).not.toBeNull()
      boxes.push(b!)
    }
    const overlaps = (a: { x: number; width: number; y: number; height: number }, b: typeof a) =>
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
    expect(overlaps(boxes[0], boxes[1])).toBe(false)
    expect(overlaps(boxes[1], boxes[2])).toBe(false)
    expect(overlaps(boxes[0], boxes[2])).toBe(false)
  })

  test('matchups collapse into a dropdown, closed by default', async ({ page }) => {
    test.setTimeout(60_000)
    await gotoPresenter(page)
    await ensureMode(page, 'scroll')

    // Collapsed by default: trigger visible, chips hidden
    const trigger = page.getByRole('button', { name: /matchups/i })
    await expect(trigger).toBeVisible({ timeout: 10000 })
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    // Scoped to the list — the header's "Reset to base deck" button also matches /base deck/i
    const baseChip = page.getByTestId('matchup-list').getByRole('button', { name: /base deck/i })
    await expect(baseChip).not.toBeVisible()

    // Expand → chips appear
    await trigger.click()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect(baseChip).toBeVisible()

    // Selecting a matchup applies the filter and re-collapses the list
    await page.getByTestId('matchup-list').locator('button').nth(1).click()
    await expect(baseChip).not.toBeVisible()
    await expect(page.getByRole('button', { name: /reset to base deck/i })).toBeVisible()
  })

  test('spotlight arrows are clickable and the view toggle yields to the close button', async ({ page }) => {
    test.setTimeout(60_000)
    await gotoPresenter(page)
    await ensureMode(page, 'scroll')

    // Open the spotlight from the first card tile
    await page.locator('button[title*="×"]').first().click()
    // NB: .first() matters — the page footer also renders an h3 in scroll view
    const cardName = page.locator('h3').first()
    await expect(cardName).toBeVisible({ timeout: 10000 })
    const before = await cardName.textContent()

    // View toggle must be hidden while spotlighted (it sits exactly over the close X)
    await expect(viewToggle(page)).toHaveCount(0)

    // Next arrow must be clickable WITHOUT force — i.e. not painted under the panel
    await page.getByRole('button', { name: 'Next card' }).click({ timeout: 5000 })
    await expect(cardName).not.toHaveText(before ?? '', { timeout: 5000 })

    // Close X works and restores the toggle
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('button', { name: 'Close' })).toHaveCount(0)
    await expect(viewToggle(page)).toBeVisible()
  })
})

test.describe('desktop viewport', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('defaults to the fit view on desktop', async ({ page }) => {
    test.setTimeout(60_000)
    await gotoPresenter(page)
    await expect(viewToggle(page)).toHaveAccessibleName(/scroll view/i, { timeout: 10000 })
  })

  test('matchup chips stay expanded in the desktop scroll view', async ({ page }) => {
    test.setTimeout(60_000)
    await gotoPresenter(page)
    await ensureMode(page, 'scroll')
    // No disclosure step needed on desktop
    await expect(page.getByTestId('matchup-list').getByRole('button', { name: /base deck/i })).toBeVisible({ timeout: 10000 })
  })
})
