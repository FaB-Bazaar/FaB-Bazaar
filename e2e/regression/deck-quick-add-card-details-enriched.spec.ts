/**
 * Deck editor — QuickAddCardDialog card-details lightbox, enriched panel:
 * format legality grid, illustrator, English printings with tcg_low prices
 * (current printing highlighted, click to switch), Buy on TCGplayer link.
 *
 * Fixture: seeded Lyath deck (Silver Age) → "Add card to … Yellow" →
 * Mocking Blow (yellow). Local DB: CC/Blitz/LL/Silver Age legal, Commoner not;
 * 4 English printings (FAB382, SLY020, SUP091 NF + RF) + FR/JA rows;
 * illustrated by Nailsen Ivanderlie.
 */

import { test, expect } from '@playwright/test'
import { createEmptyDeck, createSeededDeck, deleteDeck } from '../helpers/deck-fixtures'

test.use({
  storageState: 'e2e/auth.json',
  viewport: { width: 1280, height: 800 },
})

test('lightbox shows legality, illustrator, printings with prices and a TCGplayer link', async ({ page }) => {
  test.setTimeout(180_000)
  const deckId = await createSeededDeck(page, { namePrefix: 'e2e-carddetail-rich' })

  try {
    const deckTab = page.locator('button').filter({
      has: page.locator('span', { hasText: /\d+\/\d+/ }),
    })
    await deckTab.click()
    await page.waitForTimeout(400)

    const addYellowBtn = page.getByTitle(/Add card to .*Yellow/i).first()
    await expect(addYellowBtn).toBeVisible({ timeout: 10000 })
    await addYellowBtn.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    await dialog.getByPlaceholder(/search by name/i).first().fill('mocking blow')
    const tile = dialog.getByTestId('card-grid-tile').filter({ hasText: 'Mocking Blow' }).first()
    await expect(tile).toBeVisible({ timeout: 15000 })
    await tile.hover()
    await tile.getByRole('button', { name: /view card details for mocking blow/i }).click()

    const lightbox = page.getByTestId('card-lightbox')
    await expect(lightbox).toBeVisible({ timeout: 5000 })
    const details = lightbox.getByTestId('card-lightbox-details')

    await test.step('legality grid', async () => {
      const legality = details.getByRole('list', { name: /format legality/i })
      await expect(legality).toBeVisible()
      const items = legality.getByRole('listitem')
      await expect(items).toHaveCount(5)
      await expect(items.filter({ hasText: 'Silver Age' })).toContainText(/^Legal/)
      await expect(items.filter({ hasText: 'Commoner' })).toContainText('Not Legal')
      await expect(items.filter({ hasText: 'Classic Constructed' })).toContainText(/^Legal/)
    })

    await test.step('illustrator', async () => {
      await expect(details.getByText(/Illustrated by Nailsen Ivanderlie/i)).toBeVisible()
    })

    await test.step('printings & prices (English only, tcg_low, current highlighted)', async () => {
      const list = details.getByRole('list', { name: /printings/i })
      await expect(list).toBeVisible({ timeout: 10000 })
      const rows = list.getByRole('listitem')
      await expect(rows).toHaveCount(4)
      await expect(rows.filter({ hasText: 'FAB382' })).toContainText('$8.00')
      await expect(rows.filter({ hasText: 'SLY020' })).toContainText('$0.30')
      await expect(rows.filter({ hasText: 'SUP091' })).toHaveCount(2)
      await expect(list.locator('[aria-current="true"]')).toHaveCount(1)
      await expect(details.getByText(/4 other-language printings/i)).toBeVisible()
    })

    await test.step('clicking another printing switches the enlarged image + current marker', async () => {
      const list = details.getByRole('list', { name: /printings/i })
      const before = await lightbox.locator('img').first().getAttribute('src')
      await list.getByRole('button', { name: /FAB382/ }).click()
      await expect(list.locator('[aria-current="true"]')).toContainText('FAB382')
      const after = await lightbox.locator('img').first().getAttribute('src')
      expect(after).not.toBe(before)
    })

    await test.step('Buy on TCGplayer link', async () => {
      const buy = details.getByRole('link', { name: /buy on tcgplayer/i })
      await expect(buy).toBeVisible()
      expect(await buy.getAttribute('href')).toMatch(/tcgplayer\.com/)
      expect(await buy.getAttribute('target')).toBe('_blank')
      await page.screenshot({ path: 'e2e/screenshots/card-details-lightbox-enriched.png' })
    })
  } finally {
    await deleteDeck(page, deckId)
  }
})

test('keyword glossary explains keywords the card names without inline reminder text', async ({ page }) => {
  test.setTimeout(180_000)
  // Adult Katsu → Classic Constructed: Ancestral Harmony (HVY247) is in-pool.
  // Its rendered text bolds "combo" and a bare "Go again" with no _(reminder)_.
  const deckId = await createEmptyDeck(page, { namePrefix: 'e2e-glossary', heroQuery: 'Katsu', heroOption: /katsu, the wanderer/i })

  try {
    // Empty deck lands directly on the deck view (no N/M tab yet).
    const addBtn = page.getByTitle(/Add card to .*Blue/i).first()
    await expect(addBtn).toBeVisible({ timeout: 10000 })
    await addBtn.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await dialog.getByPlaceholder(/search by name/i).first().fill('ancestral harmony')
    const tile = dialog.getByTestId('card-grid-tile').filter({ hasText: 'Ancestral Harmony' }).first()
    await expect(tile).toBeVisible({ timeout: 15000 })
    await tile.hover()
    await tile.getByRole('button', { name: /view card details for ancestral harmony/i }).click()

    const details = page.getByTestId('card-lightbox').getByTestId('card-lightbox-details')
    const glossary = details.getByRole('definition').first().locator('xpath=ancestor::dl')
    await expect(glossary).toBeVisible({ timeout: 5000 })
    await expect(glossary).toContainText('Combo')
    await expect(glossary).toContainText(/last attack played this combat chain/i)
    await expect(glossary).toContainText('Go Again')
    await expect(glossary).toContainText(/gain 1 action point/i)
    await page.screenshot({ path: 'e2e/screenshots/card-details-lightbox-glossary.png' })
  } finally {
    await deleteDeck(page, deckId)
  }
})
