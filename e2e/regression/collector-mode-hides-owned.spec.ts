/**
 * Collector Mode (Cmd+K → U) hides the tiles you already own at the CARD
 * level — owning ANY printing of a card counts — and keeps only the copies
 * missing from your collection (2026-08 change; it previously annotated
 * without hiding).
 *
 * Fixture-free: picks one of the signed-in user's decks at runtime that has
 * both fully-owned and missing cards (per the matchBy=card comparison), so
 * nightly collection changes can't rot a hardcoded deck id.
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/auth.json' })

type CompRow = { cardName: string }
type Comparison = { owned: CompRow[]; partial: CompRow[]; missing: CompRow[] }

test('Cmd+K → U hides card-level owned tiles and keeps missing ones', async ({ page, request }) => {
  test.setTimeout(180_000)

  // ── Pick a real deck of the seeded user with owned AND missing cards ──
  const decksRes = await request.get('/api/decks')
  expect(decksRes.ok()).toBeTruthy()
  const decks: Array<{ publicId: string; heroName?: string }> = (await decksRes.json()).decks ?? []

  let deck: { publicId: string; heroName?: string } | undefined
  let comparison: Comparison | undefined
  for (const d of decks.slice(0, 10)) {
    const res = await request.get(`/api/decks/${d.publicId}/inventory-comparison?matchBy=card`)
    if (!res.ok()) continue
    const j = await res.json()
    if (j.success && j.data.owned.length > 0 && j.data.missing.length > 0) {
      deck = d
      comparison = j.data
      break
    }
  }
  test.skip(!deck, 'needs a deck with both owned and missing cards in the seeded collection')

  // Pick assertion targets whose names are unambiguous: not shared with the
  // other buckets (pitch siblings share a display name) and not the hero
  // (the portrait stays visible regardless of the filter).
  const nameSet = (rows: CompRow[]) => new Set(rows.map(r => r.cardName))
  const ownedNames = nameSet(comparison!.owned)
  const partialNames = nameSet(comparison!.partial)
  const missingNames = nameSet(comparison!.missing)
  const hero = deck!.heroName?.toLowerCase()

  const ownedName = comparison!.owned
    .map(r => r.cardName)
    .find(n => !missingNames.has(n) && !partialNames.has(n) && n.toLowerCase() !== hero)
  const missingName = comparison!.missing
    .map(r => r.cardName)
    .find(n => !ownedNames.has(n) && !partialNames.has(n) && n.toLowerCase() !== hero)
  test.skip(!ownedName || !missingName, 'needs unambiguous owned + missing card names')

  // ── Open the deck; wait for BOTH ownership fetches (hiding needs the card-level one) ──
  const cardComparisonLoaded = page.waitForResponse(
    r => r.url().includes('/inventory-comparison') && r.url().includes('matchBy=card') && r.ok()
  )
  await page.goto(`/decks/${deck!.publicId}`)
  await cardComparisonLoaded

  // Tile view is the desktop default for editors; both cards start visible.
  const ownedTile = page.getByAltText(ownedName!).first()
  const missingTile = page.getByAltText(missingName!).first()
  await expect(ownedTile).toBeVisible({ timeout: 15_000 })
  await expect(missingTile).toBeVisible()

  // ── Toggle Collector Mode via the chord ──
  await page.keyboard.press('Meta+k')
  await page.keyboard.press('u')

  // Toast announces the new semantics…
  await expect(page.getByText(/owned copies are hidden/i).first()).toBeVisible({ timeout: 5_000 })
  // …owned tiles are gone, missing ones remain.
  await expect(page.getByAltText(ownedName!)).toHaveCount(0)
  await expect(missingTile).toBeVisible()

  // ── Toggling off restores the owned tiles ──
  await page.getByRole('button', { name: /collector mode/i }).click()
  await expect(page.getByAltText(ownedName!).first()).toBeVisible({ timeout: 5_000 })
})
