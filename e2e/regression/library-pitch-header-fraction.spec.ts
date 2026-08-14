/**
 * Library pitch-section headers show their count as a fraction of the whole
 * library: "Library — Red (2/5)" instead of "Library — Red (2)".
 *
 * Applies to the per-pitch sections (red/yellow/blue/no-pitch) in BOTH the
 * tile view and the game view. Non-library sections (equipment) keep their
 * plain "(N)" count, and the "Library (N)" rollup header keeps the total.
 */

import { test, expect } from '@playwright/test'
import { createSeededDeck, deleteDeck } from '../helpers/deck-fixtures'

test.use({ storageState: 'e2e/auth.json' })

test('library pitch headers render count/total fractions in tile and game views', async ({ page }) => {
  test.setTimeout(180_000)
  // Adult Katsu (CC) + generic Sink Below: 2 red + 3 blue = library of 5.
  const deckId = await createSeededDeck(page, {
    namePrefix: 'e2e-lib-fraction',
    heroQuery: 'Katsu',
    heroOption: /katsu,/i,
    seedList: '2 Sink Below (red)\n3 Sink Below (blue)',
  })

  try {
    // Deck tab (carries the nn/nn badge) — tile view is the default.
    const deckTab = page.locator('button').filter({
      has: page.locator('span', { hasText: /\d+\/\d+/ }),
    })
    await expect(deckTab).toBeVisible({ timeout: 10000 })
    await deckTab.click()

    // ── Tile view ──
    const redSection = page.locator('#deck-section-red')
    const blueSection = page.locator('#deck-section-blue')
    await expect(redSection).toBeVisible({ timeout: 15000 })
    await expect(redSection).toContainText('Library — Red')
    await expect(redSection).toContainText('(2/5)')
    await expect(blueSection).toContainText('(3/5)')

    // Rollup header above the sections keeps the plain total.
    await expect(page.getByText('(5)', { exact: true }).first()).toBeVisible()

    // Equipment is not part of the library — its count stays un-fractioned.
    const equipmentHeader = page.locator('#deck-section-equipment')
    await expect(equipmentHeader).toBeVisible()
    await expect(equipmentHeader).not.toContainText(/\(\d+\/\d+\)/)

    // ── Game view ──
    await page.getByRole('button', { name: /^game$/i }).click()
    await expect(page.locator('#deck-section-red')).toContainText('(2/5)', { timeout: 15000 })
    await expect(page.locator('#deck-section-blue')).toContainText('(3/5)')
  } finally {
    await deleteDeck(page, deckId)
  }
})
