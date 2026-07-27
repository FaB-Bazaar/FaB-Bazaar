import { expect, type Page } from '@playwright/test'

export async function acceptCookies(page: Page) {
  const btn = page.locator('button', { hasText: /accept all/i }).first()
  try {
    await btn.waitFor({ timeout: 3000 })
    await btn.click()
    await btn.waitFor({ state: 'hidden', timeout: 3000 })
  } catch { /* no banner */ }
}

export interface DeckFixtureOptions {
  namePrefix?: string
  /** Hero search query + option regex. Default: young Lyath (Silver Age). */
  heroQuery?: string
  heroOption?: RegExp
  /** Override the default bulk-import seed list. */
  seedList?: string
}

const DEFAULTS: Required<Pick<DeckFixtureOptions, 'namePrefix' | 'heroQuery' | 'heroOption'>> = {
  namePrefix: 'e2e',
  heroQuery: 'Lyath',
  // Matches both Young ("Lyath Goldmane") and Adult ("Lyath Goldmane, Vile Savant");
  // `.first()` below picks whichever appears first — the young hero in current ordering.
  heroOption: /lyath goldmane/i,
}

/**
 * Create a blank deck via the UI. Returns the deckId (publicId).
 * Does not seed any cards.
 */
export async function createEmptyDeck(page: Page, opts: DeckFixtureOptions = {}): Promise<string> {
  const { namePrefix, heroQuery, heroOption } = { ...DEFAULTS, ...opts }

  await page.goto('/decks')
  await page.waitForLoadState('networkidle')
  await acceptCookies(page)
  await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 15000 })

  await page.getByRole('button', { name: /create new deck/i }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByPlaceholder(/search by name, class, or talent/i).fill(heroQuery)
  await dialog.getByRole('option', { name: heroOption }).first().click()

  const nameInput = page.locator('#deck-name')
  await expect(nameInput).toBeVisible()
  await nameInput.fill(`${namePrefix}-${Date.now()}`)

  await dialog.getByRole('button', { name: /^create deck$/i }).click()
  await page.waitForURL(/\/decks\/[^/]+$/, { timeout: 30000 })
  await acceptCookies(page)

  return page.url().split('/decks/')[1].split('/')[0]
}

/**
 * Create a deck and seed it with cards via the Add Cards tab bulk import flow.
 * Default: young Lyath (Silver Age) + Silver-Age-legal seed.
 */
export async function createSeededDeck(page: Page, opts: DeckFixtureOptions = {}): Promise<string> {
  const seedList = opts.seedList ?? `2 Mocking Blow (red)
1 Mocking Blow (yellow)
3x Mocking Blow (blue)
1x Arcane Lantern`

  const deckId = await createEmptyDeck(page, opts)

  await page.getByRole('button', { name: /^add cards$/i }).click()
  const textarea = page.locator('textarea').first()
  await expect(textarea).toBeVisible()
  await textarea.fill(seedList)

  await page.getByRole('button', { name: /import card list/i }).click()
  const stageAll = page.getByRole('button', { name: /stage all/i })
  await expect(stageAll).toBeVisible({ timeout: 20000 })
  await stageAll.click()

  const saveBtn = page.getByRole('button', { name: /save.*card.*to deck/i })
  await expect(saveBtn).toBeVisible({ timeout: 5000 })
  await saveBtn.click()
  await expect(saveBtn).not.toBeVisible({ timeout: 20000 })

  return deckId
}

export async function deleteDeck(page: Page, deckId: string) {
  await page.request.delete(`/api/decks/${deckId}`, { timeout: 15000 }).catch(() => {})
}
