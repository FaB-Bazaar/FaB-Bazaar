import { test, expect } from '@playwright/test'

// Regression: "Copy This Binder" created the copy but redirected to
// /binder/undefined (route returned `newBinder`, client read `data._id`).
// Fixture: another user's public binder (4 rows, 9 cards) in the local DB.
const SOURCE_BINDER_ID = '6919f6d5e2f1efa73759fb97' // "Sharkanoid"

test.use({
  storageState: 'e2e/auth.json',
  viewport: { width: 1280, height: 800 },
})

test('copying a public binder lands on the new binder', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookieConsent', 'true')
    localStorage.setItem('cookieConsentOptions', JSON.stringify({ necessary: true, analytics: false }))
  })

  await page.goto(`/binder/${SOURCE_BINDER_ID}`)
  await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 20000 })

  await page.getByRole('button', { name: /^export$/i }).first().click()
  const dialog = page.getByRole('dialog').filter({ hasText: /Make a Personal Copy/ })
  await dialog.getByRole('button', { name: /copy this binder/i }).click()

  await page.waitForURL(url => !url.pathname.endsWith(SOURCE_BINDER_ID), { timeout: 20000 })
  const newId = page.url().split('/binder/')[1]?.split(/[?#]/)[0]

  try {
    expect(newId).toBeTruthy()
    expect(newId).not.toBe('undefined')
    await expect(page.getByRole('heading', { name: /Copy of Sharkanoid/ }).first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(/Cards \(9\)/).first()).toBeVisible({ timeout: 20000 })
  } finally {
    if (newId && newId !== 'undefined') {
      await page.request.delete(`/api/binders/${newId}`)
    }
  }
})
