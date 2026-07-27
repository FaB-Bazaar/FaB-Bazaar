/**
 * Deck editor — tile action sheet (phones).
 *
 * Tapping a tile opens a bottom sheet. The card image is big enough to read, so
 * there is no "Enlarge image" row; TCGplayer is an icon beside the card name
 * rather than a full-width row; binder and wants are two icons sharing a row.
 * What's left as rows are the things that change the deck: swap and moves.
 *
 * Requires a seeded `e2e/auth.json` (gitignored — it holds a real session) and a
 * local DB with card data; the specs create and delete their own deck. Without
 * that storage state every test here fails at the fixture, not at an assertion.
 */

import { test, expect, type Page } from '@playwright/test'
import { createEmptyDeck, deleteDeck, acceptCookies } from '../helpers/deck-fixtures'

test.use({ storageState: 'e2e/auth.json' })

let deckId: string

const SEED = [
  { printingId: 'pqRjKKfJcrBCn6CqFKNPP', quantity: 2, category: 'maindeck' }, // Adrenaline Rush, red
  { printingId: 'BQQ7j8LFqkqgjtPjRJHH8', quantity: 1, category: 'maindeck' }, // Nimblism, blue
]
const SEED_CARD = /adrenaline rush/i

async function desktopContext(browser: import('@playwright/test').Browser) {
  const context = await browser.newContext({
    storageState: 'e2e/auth.json',
    viewport: { width: 1280, height: 800 },
    isMobile: false,
    hasTouch: false,
  })
  await context.addInitScript(() => {
    localStorage.setItem('cookieConsent', 'true')
    localStorage.setItem('cookieConsentOptions', JSON.stringify({ necessary: true, analytics: true, marketing: true }))
  })
  return context
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120000)
  const context = await desktopContext(browser)
  const page = await context.newPage()
  deckId = await createEmptyDeck(page, { namePrefix: 'e2e-tile-sheet' })
  const res = await page.request.post(`/api/decks/${deckId}/printings/add`, { data: { printings: SEED } })
  const json = await res.json()
  if (!json.success) throw new Error('seed failed: ' + JSON.stringify(json))
  await context.close()
})

test.afterAll(async ({ browser }) => {
  const context = await desktopContext(browser)
  const page = await context.newPage()
  await deleteDeck(page, deckId)
  await context.close()
})

async function openTileSheet(page: Page) {
  await page.goto(`/decks/${deckId}`)
  await acceptCookies(page)
  await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 20000 })
  await page.getByRole('button', { name: /^tiles$/i }).click()
  await page.getByRole('img', { name: SEED_CARD }).first().click()
  await expect(page.getByTestId('tile-sheet')).toBeVisible({ timeout: 10000 })
}

test('shows the card big enough to read its box text @mobile', async ({ page }) => {
  await openTileSheet(page)
  const art = page.getByTestId('tile-sheet-art')
  await expect(art).toBeVisible()
  await expect(page.getByTestId('tile-sheet').getByText(/enlarge image/i)).toHaveCount(0)

  const box = (await art.boundingBox())!
  const viewport = page.viewportSize()!
  // Rule text on a FaB card runs ~8% of card height; at 45% of the screen it
  // clears the ~11px that stays legible on a phone.
  expect(box.height / viewport.height).toBeGreaterThanOrEqual(0.42)
  expect(box.width).toBeGreaterThanOrEqual(210)
  expect(box.width).toBeLessThanOrEqual(viewport.width * 0.8)   // still framed, not edge-to-edge
})

// Phones are shorter than a Pixel 5 once the browser's URL bar is showing, and
// on iOS Safari `vh` measures the toolbar-hidden height — so a sheet sized in vh
// runs past the bottom of what's actually on screen and takes the options and
// Cancel with it. The art has to yield height instead.
for (const height of [640, 600, 550]) {
  test(`keeps every option reachable at ${height}px of viewport @mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height })
    await openTileSheet(page)

    const sheet = page.getByTestId('tile-sheet')
    await expect(sheet.getByRole('button', { name: /^cancel$/i })).toBeInViewport({ ratio: 0.9 })
    await expect(sheet.getByRole('button', { name: /^swap printing$/i })).toBeInViewport({ ratio: 0.9 })
    await expect(sheet.getByRole('button', { name: /move to inventory/i })).toBeInViewport({ ratio: 0.9 })
    await expect(sheet.locator('a[href*="tcgplayer"]')).toBeInViewport({ ratio: 0.9 })
    await expect(page.getByTestId('tile-sheet-binder')).toBeInViewport({ ratio: 0.9 })

    // The art is what yields, down to a floor of ~170px — on a viewport this
    // short there is nothing else left to give without hiding an action.
    const art = (await page.getByTestId('tile-sheet-art').boundingBox())!
    expect(art.height).toBeGreaterThanOrEqual(170)
    expect(art.height).toBeLessThanOrEqual(height * 0.55)
  })
}

test('reaches near the top of the screen without covering the app header @mobile', async ({ page }) => {
  await openTileSheet(page)
  const sheet = (await page.getByTestId('tile-sheet').boundingBox())!
  const viewport = page.viewportSize()!
  expect(sheet.y / viewport.height).toBeLessThanOrEqual(0.18)    // tall sheet
  expect(sheet.y).toBeGreaterThan(0)                             // header still peeks
})

test('puts TCGplayer next to the card name, not in a row of its own @mobile', async ({ page }) => {
  await openTileSheet(page)
  const link = page.getByTestId('tile-sheet').locator('a[href*="tcgplayer"]')
  await expect(link).toBeVisible()
  await expect(link.locator('img')).toBeVisible()                 // the TCGplayer mark
  await expect(page.getByTestId('tile-sheet').getByRole('button', { name: /view on tcgplayer/i })).toHaveCount(0)

  // Beside the name: same row, within a line's height of it.
  const nameBox = (await page.getByTestId('tile-sheet-name').boundingBox())!
  const linkBox = (await link.boundingBox())!
  expect(Math.abs(linkBox.y - nameBox.y)).toBeLessThanOrEqual(24)
})

test('collapses binder and wants into two icons on one row @mobile', async ({ page }) => {
  await openTileSheet(page)
  const binder = page.getByTestId('tile-sheet-binder')
  const wants = page.getByTestId('tile-sheet-wants')
  await expect(binder).toBeVisible()
  await expect(wants).toBeVisible()

  const b = (await binder.boundingBox())!
  const w = (await wants.boundingBox())!
  expect(Math.abs(b.y - w.y)).toBeLessThanOrEqual(4)              // same row
  expect(w.x).toBeGreaterThan(b.x)

  // Icon-only, so each needs its own accessible name (WCAG 4.1.2).
  await expect(binder).toHaveAttribute('aria-label', /binder/i)
  await expect(wants).toHaveAttribute('aria-label', /wants/i)

  // Tap targets stay thumb-sized even without a label.
  expect(b.height).toBeGreaterThanOrEqual(40)
  expect(w.height).toBeGreaterThanOrEqual(40)
})

test('keeps the deck-changing actions as rows @mobile', async ({ page }) => {
  await openTileSheet(page)
  const sheet = page.getByTestId('tile-sheet')
  await expect(sheet.getByRole('button', { name: /^swap printing$/i })).toBeVisible()
  await expect(sheet.getByRole('button', { name: /move to inventory/i })).toBeVisible()
  await expect(sheet.getByRole('button', { name: /^cancel$/i })).toBeVisible()
})

// Chrome DevTools' free-form "Responsive" mode emulates a phone-sized viewport but
// NOT touch, so `(pointer: coarse)` is false, the tile tap takes the desktop branch
// and you get the enlarge overlay instead of the sheet. `?touch=1` is the escape
// hatch that lets a developer drive the phone UI from a desktop browser.
test.describe('?touch override', () => {
  async function finePointerPhone(browser: import('@playwright/test').Browser) {
    const context = await browser.newContext({
      storageState: 'e2e/auth.json',
      viewport: { width: 390, height: 844 },   // phone-sized…
      hasTouch: false,                          // …but a mouse, like Responsive mode
      isMobile: false,
    })
    await context.addInitScript(() => {
      localStorage.setItem('cookieConsent', 'true')
      localStorage.setItem('cookieConsentOptions', JSON.stringify({ necessary: true, analytics: true, marketing: true }))
    })
    return context
  }

  async function openTiles(page: Page, query = '') {
    await page.goto(`/decks/${deckId}${query}`)
    await acceptCookies(page)
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 20000 })
    await page.getByRole('button', { name: /^tiles$/i }).click()
    await page.getByRole('img', { name: SEED_CARD }).first().click()
  }

  test('without the override a fine pointer still gets the desktop behaviour @mobile', async ({ browser }) => {
    const context = await finePointerPhone(browser)
    const page = await context.newPage()
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(false)

    await openTiles(page)
    await expect(page.getByTestId('tile-sheet')).toHaveCount(0)
    await context.close()
  })

  test('?touch=1 opens the sheet, and the choice survives navigation @mobile', async ({ browser }) => {
    const context = await finePointerPhone(browser)
    const page = await context.newPage()

    await openTiles(page, '?touch=1')
    await expect(page.getByTestId('tile-sheet')).toBeVisible({ timeout: 10000 })

    // Persisted: the next page load has no param but must still behave as touch.
    await page.getByTestId('tile-sheet').getByRole('button', { name: /^cancel$/i }).click()
    await openTiles(page)
    await expect(page.getByTestId('tile-sheet')).toBeVisible({ timeout: 10000 })
    await context.close()
  })

  test('?touch=auto clears the override @mobile', async ({ browser }) => {
    const context = await finePointerPhone(browser)
    const page = await context.newPage()

    await openTiles(page, '?touch=1')
    await expect(page.getByTestId('tile-sheet')).toBeVisible({ timeout: 10000 })

    await page.getByTestId('tile-sheet').getByRole('button', { name: /^cancel$/i }).click()
    await openTiles(page, '?touch=auto')
    await expect(page.getByTestId('tile-sheet')).toHaveCount(0)
    await context.close()
  })
})

// The list view has its own sheet (GroupedCardRow), which sat at z-50 — the same
// layer as the deck's floating tab bar, and earlier in the DOM, so the tab bar
// painted over its bottom rows and ate taps on them. The tile sheet was moved to
// z-[60] in 10b6f48; this one was missed.
test('list-view sheet keeps Cancel and Remove clear of the floating tab bar @mobile', async ({ page }) => {
  await page.goto(`/decks/${deckId}`)
  await acceptCookies(page)
  await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 20000 })
  await page.getByRole('button', { name: /^list$/i }).click()
  await page.getByTestId('deck-list-row').first().click()

  const sheet = page.getByTestId('list-row-sheet')
  await expect(sheet).toBeVisible({ timeout: 10000 })

  const remove = sheet.getByRole('button', { name: /remove from deck/i })
  await expect(remove).toBeInViewport({ ratio: 0.9 })

  // Clicking is the real proof: Playwright's hit test fails if the tab bar,
  // which is fixed and paints later, is sitting on top of the target.
  const cancel = sheet.getByRole('button', { name: /^cancel$/i })
  await expect(cancel).toBeInViewport({ ratio: 0.9 })
  await cancel.click({ timeout: 5000 })
  await expect(sheet).toBeHidden()
})

test('fits without hiding Cancel under the floating tab bar @mobile', async ({ page }) => {
  await openTileSheet(page)
  const cancel = page.getByTestId('tile-sheet').getByRole('button', { name: /^cancel$/i })
  await expect(cancel).toBeInViewport({ ratio: 0.9 })

  // "On screen" isn't enough — the deck's floating tab bar is fixed too. Clicking
  // proves nothing covers it: Playwright's hit test fails on an intercepted click.
  await cancel.click({ timeout: 5000 })
  await expect(page.getByTestId('tile-sheet')).toBeHidden()
})
