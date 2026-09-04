/**
 * Deck editor tiles view — polish from the 2026-09 desktop walkthrough.
 *
 *  1. The binder the ownership dots compare against was an unlabelled dropdown
 *     ("silver") — it now carries a visible "Compare to" label.
 *  2. Empty zones (Inventory / Bench / an empty pitch colour) rendered a full
 *     card-sized dashed "+" tile each; they now collapse to a slim header row
 *     whose add button is always visible (not hover-only).
 *  3. "Not in binder" was a solid red dot on ~every tile of a deck you don't own;
 *     it is now a quiet outline so the green "in your binder" dot carries the signal.
 *
 * Needs `e2e/auth.json` + a local DB with card data; creates and deletes its own deck.
 */

import { test, expect, type Page } from '@playwright/test'
import { createSeededDeck, deleteDeck } from '../helpers/deck-fixtures'

test.use({ storageState: 'e2e/auth.json' })

const TILE_IMG = '[data-focus-id] img[alt]:not([alt=""]):not(button img):visible'
let deckId: string

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000)
  const page = await browser.newPage({ storageState: 'e2e/auth.json', viewport: { width: 1280, height: 800 } })
  deckId = await createSeededDeck(page, {
    namePrefix: 'e2e-tiles-polish',
    heroQuery: 'Katsu',
    heroOption: /katsu,/i,
    seedList: '3 Sink Below (red)\n3 Sink Below (blue)',
  })
  await page.goto(`/decks/${deckId}`)
  await expect(page.locator('#deck-section-red')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: /^tiles$/i }).click()
  await expect(page.locator(TILE_IMG)).toHaveCount(6, { timeout: 20_000 })
  await page.close()
})

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: 'e2e/auth.json' })
  await deleteDeck(page, deckId)
  await page.close()
})

async function openTiles(page: Page) {
  await page.goto(`/decks/${deckId}`)
  await expect(page.locator('#deck-section-red')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: /^tiles$/i }).click()
  await expect(page.locator(TILE_IMG).first()).toBeVisible()
}

test('the ownership-comparison binder dropdown is labelled "Compare to"', async ({ page }) => {
  await openTiles(page)
  await expect(page.getByText('Compare to', { exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: /compare to/i })).toBeVisible()
})

test('empty zones collapse to a slim header with an always-visible add button', async ({ page }) => {
  await openTiles(page)
  for (const zone of ['inventory', 'bench'] as const) {
    const section = page.locator(`#deck-section-${zone}`)
    await expect(section).toBeVisible()
    const box = (await section.boundingBox())!
    expect(box.height, `${zone} section should be a single header row`).toBeLessThanOrEqual(60)
    await page.mouse.move(5, 5) // no hover on the section
    const add = section.getByRole('button', { name: /add card to/i })
    await expect(add).toBeVisible()
    await expect(add).toHaveCSS('opacity', '1')
  }
  // A populated section keeps its trailing dashed "+" tile.
  await expect(page.locator('#deck-section-red').getByRole('button', { name: 'Add a card here' })).toBeVisible()
})

test('"not in binder" is an outline marker, not a solid red dot', async ({ page }) => {
  await openTiles(page)
  const missing = page.locator('[data-ownership="missing"]').first()
  await expect(missing).toBeVisible()
  await expect(missing).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(missing).toHaveCSS('border-color', /239, 68, 68|248, 113, 113/) // tailwind red-500 / red-400
  const legend = page.getByTestId('legend-missing')
  await expect(legend).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
})
