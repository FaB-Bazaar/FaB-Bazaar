/**
 * Non-owner binder → select for-trade cards → "Notify on Discord".
 *
 * Before: the only way to ping a binder owner was as a side effect of
 * "Copy to Clipboard" (fire-and-forget, no feedback). Now the trade
 * sidebar has an explicit Notify button that awaits the ping and tells
 * the viewer whether it fired or was suppressed by the dedupe window.
 *
 * The notify route is intercepted (page.route) so the spec never posts
 * to the real Discord webhook; the route itself is covered by
 * app/api/binders/[binderId]/notify-trade/route.test.ts.
 *
 * Fixture: a public binder owned by someone other than the seeded user
 * with at least one for-trade card (picked dynamically).
 */

import { test, expect } from '@playwright/test'
import { execSync } from 'child_process'
import { acceptCookies } from '../helpers/deck-fixtures'

const sql = (query: string) =>
  execSync(`docker exec fabbazaar-postgres psql -U fabbazaar -d fabbazaar -t -A -c "${query}"`)
    .toString()
    .trim()

const SEEDED_USER_ID = '68056532ccbe5f869784823a'

test.use({
  storageState: 'e2e/auth.json',
  viewport: { width: 1440, height: 900 },
})

let binderId: string
let cardName: string

test.beforeAll(() => {
  const row = sql(`
    SELECT b.id || '|' || c.display_name
    FROM binders b
    JOIN inventory_items i ON i.binder_id = b.id AND i.for_trade
    JOIN printings p ON p.printing_id = i.printing_id
    JOIN cards c ON c.card_unique_id = p.card_unique_id
    WHERE b.is_public AND b.user_id <> '${SEEDED_USER_ID}'
      AND (SELECT count(*) FROM inventory_items x WHERE x.binder_id = b.id) <= 80
    ORDER BY b.id ASC, c.display_name ASC LIMIT 1;`)
  ;[binderId, cardName] = row.split('|')
  expect(binderId).toBeTruthy()
  expect(cardName).toBeTruthy()
})

async function selectFirstForTradeCard(page: import('@playwright/test').Page) {
  await page.goto(`/binder/${binderId}`)
  await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 15000 })
  await page.locator(`img[alt="${cardName}"]`).first().click()
  await expect(page.getByRole('heading', { name: 'Trade Request' })).toBeVisible()
}

test('Notify on Discord posts the selected cards and confirms the ping', async ({ page }) => {
  let posted: any = null
  await page.route('**/api/binders/*/notify-trade', async (route) => {
    posted = route.request().postDataJSON()
    await route.fulfill({ json: { success: true, data: { notified: true } } })
  })

  await selectFirstForTradeCard(page)

  const notify = page.getByTestId('notify-discord-button')
  await expect(notify).toBeEnabled()
  await notify.click()

  await expect(page.getByText('Pinged on Discord', { exact: true })).toBeVisible()
  expect(posted).not.toBeNull()
  expect(posted.cards.map((c: any) => c.name)).toContain(cardName)
  expect(posted.cards[0].quantity).toBeGreaterThanOrEqual(1)
})

test('a deduped ping is reported as already-pinged, not as an error', async ({ page }) => {
  await page.route('**/api/binders/*/notify-trade', (route) =>
    route.fulfill({ json: { success: true, data: { notified: false } } }),
  )

  await selectFirstForTradeCard(page)
  await page.getByTestId('notify-discord-button').click()

  await expect(page.getByText('Already pinged recently', { exact: true })).toBeVisible()
})

test('Copy to Clipboard no longer pings Discord — that is the Notify button\'s job', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])

  let notifyCalls = 0
  await page.route('**/api/binders/*/notify-trade', async (route) => {
    notifyCalls += 1
    await route.fulfill({ json: { success: true, data: { notified: true } } })
  })

  await selectFirstForTradeCard(page)
  await acceptCookies(page) // fixed-position banner covers the sidebar footer
  await page.getByRole('button', { name: 'Copy to Clipboard' }).click()

  await expect(page.getByText('Copied to Clipboard!', { exact: true })).toBeVisible()
  // The success toast must not claim a ping happened either.
  await expect(page.getByText(/We pinged/)).toHaveCount(0)
  expect(notifyCalls).toBe(0)
})
