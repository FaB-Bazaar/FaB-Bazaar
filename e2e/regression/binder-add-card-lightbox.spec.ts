/**
 * Binder "Search Cards" dialog → Select Printing: the printing image opens the
 * shared card-details lightbox (the one deck tiles, /opt and QuickAdd use), so
 * a collector can read the card and compare printings before adding it.
 * Picking a printing inside the lightbox becomes the dialog's selected printing.
 *
 * Desktop-first feature. Uses the seeded superadmin (e2e/auth.json) and one of
 * their binders; nothing is added to the binder.
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/auth.json', viewport: { width: 1280, height: 800 } })

const BINDER_ID = '68a232603a18e1ed0bd3e804'

test('the printing image opens the card lightbox, and a lightbox printing pick sticks', async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => {
    localStorage.setItem('cookieConsent', 'true')
    localStorage.setItem('cookieConsentOptions', JSON.stringify({ necessary: true, analytics: false, advertising: false }))
  })
  await page.goto(`/binder/${BINDER_ID}`)
  await page.getByRole('button', { name: /add card/i }).first().click({ timeout: 30000 })

  const dialog = page.getByRole('dialog', { name: /search cards/i })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('textbox').first().fill('heist')
  await dialog.getByText('Heist', { exact: true }).first().click({ timeout: 20000 })

  const image = dialog.getByRole('button', { name: /view heist details/i })
  await expect(image).toBeVisible({ timeout: 10000 })
  await image.click()

  const lightbox = page.getByTestId('card-lightbox')
  await expect(lightbox).toBeVisible({ timeout: 5000 })
  const details = lightbox.getByTestId('card-lightbox-details')
  await expect(details.getByText('Heist').first()).toBeVisible()
  await expect(details.getByText(/illustrated by/i)).toBeVisible()

  await test.step('picking another printing in the lightbox selects it in the dialog', async () => {
    const printings = details.getByRole('list', { name: /^printings$/i })
    await expect(printings).toBeVisible({ timeout: 30000 }) // sibling printings load lazily; slow on a cold dev server
    const chip = printings.getByRole('button').filter({ hasText: /\$/ }).last()
    const chipText = (await chip.innerText()).replace(/\s+/g, ' ')
    await chip.click()
    await page.keyboard.press('Escape')
    await expect(lightbox).not.toBeVisible()
    await expect(dialog).toBeVisible()
    const price = chipText.match(/\$\d+\.\d\d/)?.[0]
    if (price) await expect(dialog.getByRole('combobox').first()).toContainText(price)
  })

  await test.step('clicking the lightbox backdrop closes only the lightbox', async () => {
    await dialog.getByRole('button', { name: /view heist details/i }).click()
    await expect(lightbox).toBeVisible()
    await page.screenshot({ path: 'test-results/binder-lightbox-open.png' })
    await page.mouse.click(20, 400) // dark backdrop, left of the card
    await expect(lightbox).not.toBeVisible()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: /add to binder/i })).toBeEnabled()
  })
})
