/**
 * Mobile Cards tab (MobileCardSearch) regressions — /decks/[id] at phone width.
 *
 *  1. The sticky search input must stay reachable while scrolled deep into the
 *     results. It used to stick at `top-0`, i.e. UNDER the sticky navbar, so
 *     only the chip rows stayed visible and the text box needed a scroll to
 *     the very top of the page.
 *  2. Tapping + on a tile must not re-run the search. The deck refresh after
 *     an add rebuilt the hero filter object, which re-fired the search effect:
 *     a "Load more"d list collapsed back to page 1 (scroll jumped) and the
 *     printing picks were reset.
 */

import { test, expect, type Page } from '@playwright/test'
import { createEmptyDeck, deleteDeck } from '../helpers/deck-fixtures'

test.use({ storageState: 'e2e/auth.json' })

let deckId = ''

test.beforeAll(async ({ browser }) => {
  // The create-deck flow is desktop-only UI; seed at desktop width.
  const ctx = await browser.newContext({ storageState: 'e2e/auth.json', viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  deckId = await createEmptyDeck(page, { namePrefix: 'e2e-mobile-search' })
  await ctx.close()
})

test.afterAll(async ({ browser }) => {
  if (!deckId) return
  const ctx = await browser.newContext({ storageState: 'e2e/auth.json' })
  const page = await ctx.newPage()
  await deleteDeck(page, deckId)
  await ctx.close()
})

async function openCardsTab(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('cookieConsent', 'true')
    localStorage.setItem('cookieConsentOptions', JSON.stringify({ analytics: false }))
  })
  await page.goto(`/decks/${deckId}`)
  // The Next dev overlay portal intercepts taps on the bottom tab pill.
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important }' }).catch(() => {})
  await page.getByRole('navigation', { name: /deck sections/i }).getByRole('button', { name: /^cards$/i }).click()
  const input = page.locator('input[type="search"]').first()
  await expect(input).toBeVisible()
  // Browse the whole hero pool (no query) so there are several result pages.
  // The Kits/All cards toggle only renders when the hero has curated kits.
  const allCards = page.getByRole('button', { name: /all cards/i }).first()
  if (await allCards.isVisible().catch(() => false)) await allCards.click()
  await expect(page.getByRole('button', { name: 'Add one' }).first()).toBeVisible({ timeout: 20000 })
  return input
}

async function scrollDeep(page: Page) {
  const loadMore = page.getByRole('button', { name: /load more/i })
  const tiles = page.getByRole('button', { name: 'Add one' })
  const pageOne = await tiles.count()
  await loadMore.scrollIntoViewIfNeeded()
  await loadMore.click()
  await expect.poll(() => tiles.count(), { timeout: 30000 }).toBeGreaterThan(pageOne)
  const target = tiles.nth((await tiles.count()) - 4)
  await target.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  return target
}

test('search input stays reachable when scrolled deep into results @mobile', async ({ page }) => {
  const input = await openCardsTab(page)
  await scrollDeep(page)

  const box = await input.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  // The element under the input's centre must be the input itself — not the navbar.
  const hit = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y)
    return el ? `${el.tagName.toLowerCase()}${el.getAttribute('type') ? `[${el.getAttribute('type')}]` : ''}` : 'none'
  }, [box!.x + box!.width / 2, box!.y + box!.height / 2])
  expect(hit).toBe('input[search]')
})

test('tapping + keeps scroll position and does not re-run the search @mobile', async ({ page }) => {
  await openCardsTab(page)
  const target = await scrollDeep(page)

  const searches: string[] = []
  page.on('request', r => { if (r.url().includes('/api/printings/search')) searches.push(r.url()) })
  const before = await page.evaluate(() => window.scrollY)
  const tilesBefore = await page.getByRole('button', { name: 'Add one' }).count()

  await target.click()
  // Wait for the add + deck refresh round-trip to settle.
  await page.waitForResponse(r => r.url().includes(`/api/decks/${deckId}`) && r.request().method() === 'GET', { timeout: 15000 })
  await page.waitForTimeout(1000)

  expect(searches, 'no search re-run after add').toHaveLength(0)
  expect(await page.getByRole('button', { name: 'Add one' }).count()).toBe(tilesBefore)
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(4)
})
