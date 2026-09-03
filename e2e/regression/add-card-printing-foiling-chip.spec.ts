/**
 * Binder "Add Card" dialog → Select Printing dropdown shows foiling as a chip.
 *
 * Before: the foiling was buried as a bare word inside the option text
 * ("Everfest 1st Normal (EVR071)") — it read as part of the set name, and
 * unknown codes (gold foil 'g') fell through to the raw letter.
 *
 * After: each option carries a compact foiling chip (NF / RF / CF / GF) next
 * to the language code, with the full foiling name in its title/aria-label.
 * The option text itself no longer contains the foiling word.
 *
 * Fixture: Signal Jammer — EVR071 in EN non-foil + EN rainbow foil, plus
 * 2HP373 in fr/de/es/it (non-foil only). The owner flow API-seeds its own
 * (empty) binder so the Add Card button is available; cleaned up in afterAll.
 */

import { test, expect } from '@playwright/test'

test.use({
  storageState: 'e2e/auth.json',
  viewport: { width: 1280, height: 900 },
})

let binderId: string

test.beforeAll(async ({ request }) => {
  const suffix = Date.now().toString(36)
  const res = await request.post('/api/binders', {
    data: { name: `E2E Foil Chip ${suffix}`, slug: `e2e-foil-chip-${suffix}` },
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  binderId = body.binder?._id || body.binder?.id || body.data?._id
  expect(binderId).toBeTruthy()
})

test.afterAll(async ({ request }) => {
  if (binderId) await request.delete(`/api/binders/${binderId}`)
})

test('printing dropdown shows a foiling chip per option', async ({ page }) => {
  await page.goto(`/binder/${binderId}`)
  await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: /Add Card/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await dialog.getByPlaceholder('Search by card name...').fill('Signal Jammer')
  await expect(dialog.locator('[class*="border-l-"]').first()).toBeVisible({ timeout: 8000 })
  await dialog.locator('[class*="border-l-"]').first().click()
  await expect(dialog.getByRole('tab', { name: /Select Printing/i })).toBeVisible()

  // Closed trigger: selected printing shows its chip too
  const trigger = dialog.getByRole('combobox')
  await expect(trigger.getByTestId('foiling-chip')).toBeVisible()

  await trigger.click()
  const listbox = page.getByRole('listbox')
  await expect(listbox).toBeVisible()

  const options = listbox.getByRole('option').filter({ hasText: 'EVR071' })
  await expect(options).toHaveCount(2)

  const nonFoil = options.filter({ has: page.getByTestId('foiling-chip').filter({ hasText: /^NF$/ }) })
  const rainbow = options.filter({ has: page.getByTestId('foiling-chip').filter({ hasText: /^RF$/ }) })
  await expect(nonFoil).toHaveCount(1)
  await expect(rainbow).toHaveCount(1)

  await expect(nonFoil.getByTestId('foiling-chip')).toHaveAttribute('title', 'Non-foil')
  await expect(rainbow.getByTestId('foiling-chip')).toHaveAttribute('title', 'Rainbow Foil')

  // The bare foiling words are gone from the option text
  await expect(nonFoil).not.toContainText(/\bNormal\b/)
  await expect(rainbow).not.toContainText(/\bRainbow\b/)
  await expect(nonFoil).toContainText('Everfest 1st (EVR071)')

  // Every option (all 6 printings) has exactly one chip
  const allOptions = listbox.getByRole('option').filter({ hasNotText: 'Cheapest option' })
  await expect(allOptions).toHaveCount(6)
  await expect(listbox.getByTestId('foiling-chip')).toHaveCount(6)

  await page.screenshot({ path: 'e2e/screenshots/add-card-foiling-chip.png' })
})
