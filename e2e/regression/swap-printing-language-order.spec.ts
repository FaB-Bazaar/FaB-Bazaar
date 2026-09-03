/**
 * Binder "Change Printing" (swap) dialog — language display + canonical order.
 *
 * Bug: the swap dialog rendered every language variant of a printing as an
 * identical-looking row (no language shown) and sorted printings by raw
 * alphabetical set code, unlike the binder's add-card dialog which uses
 * sortPrintingsByLanguage(sortPrintings(...)) and shows a flag + language code
 * per printing.
 *
 * Fixture: Crown of Providence — 15 printings across 7 sets and 6 languages
 * (ANQ en/ja, DTD en/fr/de/es/it, PEN en/fr/ja, RAP ja-only, FAB gold foil,
 * UPR c/r, LSS). Canonical order computed by the same utils the add-card
 * dialog uses:
 *   EN: UPR182(r), UPR182(c), DTD221, ANQ005, PEN310, LSS013, FAB088(gold last)
 *   then FR group, JA group, then other languages (de, es, it).
 *
 * Owner flow API-seeds its own binder holding the EN DTD221 copy; cleaned up
 * in afterAll.
 */

import { test, expect } from '@playwright/test'
import { execSync } from 'child_process'

const sql = (query: string) =>
  execSync(`docker exec fabbazaar-postgres psql -U fabbazaar -d fabbazaar -t -A -c "${query}"`)
    .toString()
    .trim()

test.use({
  storageState: 'e2e/auth.json',
  viewport: { width: 1440, height: 900 },
})

// collector_number:language, in canonical add-card-dialog order
const EXPECTED_ORDER = [
  'UPR182:en', 'UPR182:en', 'DTD221:en', 'ANQ005:en', 'PEN310:en', 'LSS013:en', 'FAB088:en',
  'DTD221:fr', 'PEN310:fr',
  'ANQ005:ja', 'PEN310:ja', 'RAP107:ja',
  'DTD221:de', 'DTD221:es', 'DTD221:it',
]

let binderId: string
let printingId: string

test.beforeAll(async ({ request }) => {
  // The English DTD copy of Crown of Providence
  printingId = sql(`
    SELECT p.printing_id FROM printings p
    JOIN cards c ON c.card_unique_id = p.card_unique_id
    WHERE c.display_name ILIKE 'Crown of Providence'
      AND p.set = 'dtd' AND p.language = 'en' LIMIT 1;`)
  expect(printingId).toBeTruthy()

  const suffix = Date.now().toString(36)
  const res = await request.post('/api/binders', {
    data: { name: `E2E Swap Lang ${suffix}`, slug: `e2e-swap-lang-${suffix}` },
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  binderId = body.binder?._id || body.binder?.id || body.data?._id
  expect(binderId).toBeTruthy()

  const addRes = await request.post(`/api/binders/${binderId}/cards`, {
    data: { printingId, quantity: 1 },
  })
  expect(addRes.ok()).toBeTruthy()
})

test.afterAll(async ({ request }) => {
  if (binderId) await request.delete(`/api/binders/${binderId}`)
})

test('swap dialog shows language per printing and canonical order', async ({ page }) => {
  await page.goto(`/binder/${binderId}`)
  await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 15000 })

  // The foiling pill on the binder card opens the swap dialog
  await page.locator('[title="Click to change printing"]').first().click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 5000 })
  await expect(dialog.getByText('Change Printing: Crown of Providence')).toBeVisible()

  // All 15 printings load
  const rows = dialog.locator('button[class*="rounded-lg border"]')
  await expect(rows).toHaveCount(15, { timeout: 15000 })

  // Every row exposes its collector number and language; order is canonical
  const got: string[] = []
  for (let i = 0; i < 15; i++) {
    const text = (await rows.nth(i).innerText()).replace(/\s+/g, ' ')
    const cn = text.match(/[A-Z]{3}\d{3}/)?.[0]
    const lang = text.match(/\b(EN|FR|JA|DE|ES|IT)\b/)?.[1]?.toLowerCase()
    got.push(`${cn}:${lang}`)
  }
  expect(got).toEqual(EXPECTED_ORDER)

  // Language flags render (Japanese appears 3× among the fixtures)
  await expect(dialog.getByText('🇯🇵')).toHaveCount(3)
})

test('rows price with TCG Low, never unlabeled market', async ({ page }) => {
  // The seeded DTD-en printing has divergent low/market, so asserting one
  // genuinely excludes the other. Values read from the DB at run time.
  const [low, market] = sql(`
    SELECT p.tcg_low || '|' || p.tcg_market FROM printings p
    WHERE p.printing_id = '${printingId}';`).split('|').map(Number)
  expect(low).toBeGreaterThan(0)
  expect(market).not.toBe(low)

  await page.goto(`/binder/${binderId}`)
  await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 15000 })
  await page.locator('[title="Click to change printing"]').first().click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 5000 })
  await expect(dialog.locator('button[class*="rounded-lg border"]')).toHaveCount(15, { timeout: 15000 })

  // The binder-wide price field is TCG Low — the swap dialog must match
  await expect(dialog.getByText(`TCG Low: $${low.toFixed(2)}`)).toBeVisible()
  // A row with a low must not price itself off market
  await expect(dialog.getByText(`$${market.toFixed(2)}`)).toHaveCount(0)
})
