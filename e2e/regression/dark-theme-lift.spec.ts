import { test, expect, type Page } from '@playwright/test'

// Site-wide dark theme lift (2026-09): the dark surfaces move up one notch —
// page #030712 → #111827, gray-900 → #182132, gray-800 → #263145 — so the site
// is no longer "a little too dark". Light mode must be untouched.
test.use({ storageState: 'e2e/auth.json', viewport: { width: 1280, height: 800 } })

async function openDaily(page: Page, dark: boolean) {
  await page.addInitScript((d) => {
    localStorage.setItem('cookieConsent', 'true')
    localStorage.setItem('cookieConsentOptions', JSON.stringify({ necessary: true, analytics: false }))
    localStorage.setItem('darkMode', String(d))
  }, dark)
  await page.goto('/daily')
  await expect(page.locator('div.min-h-screen.dark\\:bg-gray-900').first()).toBeAttached({ timeout: 60000 })
}
const bg = (page: Page, sel: string) => page.locator(sel).first().evaluate(el => getComputedStyle(el).backgroundColor)

test('dark mode: page and gray-900 surfaces are lifted', async ({ page }) => {
  await openDaily(page, true)
  expect(await bg(page, 'body')).toBe('rgb(17, 24, 39)')                               // #111827
  expect(await bg(page, 'div.min-h-screen.dark\\:bg-gray-900')).toBe('rgb(24, 33, 50)') // #182132
})

test('light mode is unchanged', async ({ page }) => {
  await openDaily(page, false)
  expect(await bg(page, 'div.min-h-screen.dark\\:bg-gray-900')).toBe('rgb(243, 244, 246)') // bg-gray-100
})

// The lift must not freeze hover states: an !important base colour would beat
// dark:hover:bg-… and buttons would stop reacting. (v2's view toggle: an
// unselected tab is dark:bg-gray-900 with dark:hover:bg-gray-800.)
test('dark mode: hover colours still apply on lifted surfaces', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookieConsent', 'true')
    localStorage.setItem('cookieConsentOptions', JSON.stringify({ necessary: true, analytics: false }))
    localStorage.setItem('darkMode', 'true')
    localStorage.setItem('deckV2View', 'table')
  })
  await page.goto('/decks/TofxuKKxD0ESwVR93b5AC')
  const cards = page.getByRole('group', { name: 'Deck view' }).getByRole('button', { name: 'Cards' })
  await expect(cards).toBeVisible({ timeout: 60000 })
  await page.mouse.move(5, 5)
  expect(await cards.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(24, 33, 50)') // lifted gray-900
  await cards.hover()
  await expect.poll(() => cards.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(31, 41, 55)') // gray-800 hover
})

// Semi-transparent variants lift too, keeping their opacity: e.g. the classic
// deck page's stat chips (dark:bg-gray-900/60) and v2's Table group rows
// (dark:bg-gray-800/60).
test('dark mode: opacity variants are lifted with the same alpha', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookieConsent', 'true')
    localStorage.setItem('cookieConsentOptions', JSON.stringify({ necessary: true, analytics: false }))
    localStorage.setItem('darkMode', 'true')
    localStorage.setItem('deckV2View', 'table')
  })
  // A classic-page chip carries the class; the classic page is /deprecated.
  await page.goto('/decks/TofxuKKxD0ESwVR93b5AC/deprecated')
  const chip = page.locator('span.dark\\:bg-gray-900\\/60').first()
  await expect(chip).toBeAttached({ timeout: 60000 })
  expect(await chip.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(24, 33, 50, 0.6)')
  await page.goto('/decks/TofxuKKxD0ESwVR93b5AC')
  const groupRow = page.locator('tr.dark\\:bg-gray-800\\/60').first()
  await expect(groupRow).toBeAttached({ timeout: 60000 })
  expect(await groupRow.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(38, 49, 69, 0.6)')
})
