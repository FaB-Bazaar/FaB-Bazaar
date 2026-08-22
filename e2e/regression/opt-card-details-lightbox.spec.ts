/**
 * /opt image results — the Expand button (upper-right of a tile) opens the
 * shared card-details lightbox: image + name/type/stats/rules, legality strip
 * (no deck context on /opt), "In your binders", grouped printings with tcg_low,
 * and the Wants-style TCGplayer purchase link.
 *
 * Fixture: seeded user (mistercakes) + a throwaway binder holding 2× yellow
 * Mocking Blow (SUP091 NF) inserted straight into Postgres.
 */

import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'

test.use({
  storageState: 'e2e/auth.json',
  viewport: { width: 1280, height: 800 },
})

const E2E_USER_ID = '68056532ccbe5f869784823a'
const YELLOW_MB_SUP091_NF = 'pCwG9QgRGKGWgMTPfz8Jh'
const BINDER_ID = 'e2e-opt-lightbox-binder-0001'
const BINDER_NAME = 'E2E Opt Lightbox Binder'
const psql = (sqlText: string) =>
  execSync(`docker exec -i fabbazaar-postgres psql -U fabbazaar -d fabbazaar -v ON_ERROR_STOP=1 -c "${sqlText.replace(/"/g, '\\"')}"`, { stdio: 'pipe' })

test.beforeAll(() => {
  psql(`DELETE FROM binders WHERE id='${BINDER_ID}'`)
  psql(`INSERT INTO binders (id, user_id, name, slug) VALUES ('${BINDER_ID}', '${E2E_USER_ID}', '${BINDER_NAME}', 'e2e-opt-lightbox-binder')`)
  psql(`INSERT INTO inventory_items (id, user_id, binder_id, printing_id, quantity) VALUES ('e2e-opt-lightbox-item-0001', '${E2E_USER_ID}', '${BINDER_ID}', '${YELLOW_MB_SUP091_NF}', 2)`)
})
test.afterAll(() => { psql(`DELETE FROM binders WHERE id='${BINDER_ID}'`) })

test('expand button on an /opt image tile opens the enriched card-details lightbox', async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => {
    localStorage.setItem('cookieConsent', 'true')
    localStorage.setItem('cookieConsentOptions', JSON.stringify({ necessary: true, analytics: false, advertising: false }))
  })
  await page.goto('/opt?q=mocking%20blow')
  await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 15000 })

  // Yellow Mocking Blow tile (grouped view → one tile per card/pitch)
  const tile = page.locator('[class*="group"]').filter({ has: page.getByRole('button', { name: /preview mocking blow/i }) }).first()
  const expand = page.getByRole('button', { name: /preview mocking blow/i })
  await expect(expand.first()).toBeAttached({ timeout: 15000 })
  // Pick the yellow pitch: hover each candidate until the lightbox reports Pitch 2
  const count = await expand.count()
  let opened = false
  for (let i = 0; i < count && !opened; i++) {
    await expand.nth(i).click({ force: true })
    const lb = page.getByTestId('card-lightbox')
    await expect(lb).toBeVisible({ timeout: 5000 })
    if (await lb.getByText(/^Pitch 2$/).count()) { opened = true; break }
    await page.keyboard.press('Escape')
    await expect(lb).toHaveCount(0)
  }
  expect(opened).toBe(true)
  void tile

  const lightbox = page.getByTestId('card-lightbox')
  const details = lightbox.getByTestId('card-lightbox-details')

  await test.step('identity + rules', async () => {
    await expect(details.getByText('Mocking Blow').first()).toBeVisible()
    await expect(details.getByText(/Reviled Action - Attack/i)).toBeVisible()
    await expect(details.getByText(/the crowd boos/i)).toBeVisible()
    await expect(details.getByText(/Illustrated by Nailsen Ivanderlie/i)).toBeVisible()
  })

  await test.step('legality strip without deck context', async () => {
    const legality = details.getByRole('group', { name: /legality/i })
    await expect(legality).toBeVisible()
    await expect(legality.getByRole('list', { name: /other formats/i }).getByRole('listitem')).toHaveCount(5)
    await expect(details.getByText(/In this deck/i)).toHaveCount(0)
    await expect(details.getByText(/Legal in /i)).toHaveCount(0)
  })

  await test.step('binders line', async () => {
    const binders = details.getByRole('group', { name: /in your binders/i })
    await expect(binders).toBeVisible({ timeout: 10000 })
    await expect(binders).toContainText(BINDER_NAME)
    await expect(binders).toContainText('×2')
  })

  await test.step('printings + purchase link', async () => {
    const list = details.getByRole('list', { name: /printings/i })
    await expect(list).toBeVisible({ timeout: 10000 })
    await expect(list.getByRole('listitem')).toHaveCount(3)
    await expect(list.getByRole('listitem').filter({ hasText: 'FAB382' }).getByRole('button')).toContainText('$8.00')
    const link = details.getByRole('link', { name: /available for purchase here/i })
    await expect(link).toBeVisible()
    expect(await link.getAttribute('href')).toMatch(/tcgplayer\.com/)
    await page.screenshot({ path: 'e2e/screenshots/opt-card-details-lightbox.png' })
  })

  await test.step('Escape closes it', async () => {
    await page.keyboard.press('Escape')
    await expect(lightbox).toHaveCount(0)
  })
})
