import { test, expect } from '@playwright/test'

/**
 * Sideboard Plan → Full Deck view: equipment brought in from the sideboard
 * (inventory) must render under "Equipment & Weapons", not fall through to the
 * unpitched "Library" section. getCardSection used to classify a card as
 * equipment only when it sat in the deck's equipment/hero SLOTS, so sideboard
 * gear like Teklo Foundry Heart landed in "Library".
 *
 * Fixture: local prod-copy deck "Dash Nitro Mechanoid", whose Arakni,
 * Marionette matchup sides in Achilles Accelerator + Teklo Foundry Heart
 * (both Equipment, no pitch).
 */

test.use({ storageState: 'e2e/auth.json' })

const DECK_PUBLIC_ID = 'UYkgaHN_ARmUm1KJhdvM4'

test('Full Deck view groups sided-in equipment under Equipment & Weapons', async ({ page }) => {
  await page.goto(`/decks/${DECK_PUBLIC_ID}/matchups`)

  await page
    .getByRole('button', { name: 'View sideboard cards for Arakni, Marionette matchup' })
    .click()

  const overlay = page.getByRole('dialog', { name: /Sideboard Plan/ })
  await expect(overlay).toBeVisible()

  await overlay.getByRole('radio', { name: /Full Deck/ }).click()

  // Section container = heading row + card grid; match it by its heading text.
  const section = (label: RegExp) =>
    overlay.locator('div.mb-4').filter({ has: page.locator('p', { hasText: label }) })

  const equipmentSection = section(/^Equipment & Weapons/)
  await expect(equipmentSection.getByText('Teklo Foundry Heart')).toBeVisible()
  await expect(equipmentSection.getByText('Achilles Accelerator')).toBeVisible()

  // The unpitched "Library" section must not claim them (it should be gone
  // entirely for this deck — every unpitched card here is gear).
  const librarySection = section(/^Library\s*\(/)
  await expect(librarySection.getByText('Teklo Foundry Heart')).toHaveCount(0)
  await expect(librarySection.getByText('Achilles Accelerator')).toHaveCount(0)

  // Pitched library cards stay in their pitch sections. (The evo-equipment
  // exception is pinned by the isGearPrinting unit tests — this deck copy
  // carries no evo cards to assert on.)
  const redSection = section(/^Library — Red/)
  await expect(redSection.getByText('Pulsewave Harpoon')).toBeVisible()
  await expect(equipmentSection.getByText('Pulsewave Harpoon')).toHaveCount(0)
})
