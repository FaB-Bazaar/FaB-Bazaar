/**
 * Store page → Trade Opportunities → "They want — you have" → Notify.
 *
 * A trader tile now carries a Notify button so the viewer can tell the
 * other player "I have the cards you're looking for" without leaving the
 * store page. It posts to /api/wants/user/[userId]/notify-interest and
 * reports whether the ping fired.
 *
 * Both the trade-matches feed and the notify route are intercepted so the
 * spec is independent of local inventory data and never hits Discord.
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

const MATCH = {
  userId: 'trader-0001',
  username: 'mattave',
  displayUsername: 'mattave',
  avatarUrl: null,
  theyHaveYouWant: [],
  // foiling uses the service's short labels (RF/CF/GF/NF)
  theyWantYouHave: [
    { printingId: 'p-dig', displayName: 'Dig Up Dinner', set: 'sea', foiling: 'NF', collectorNumber: 'SEA015', quantity: 3, tcgLow: 0.38, imageUrl: null },
    { printingId: 'p-pou', displayName: 'Pounamu Amulet', set: 'sea', foiling: 'RF', collectorNumber: 'SEA090', quantity: 1, tcgLow: 8.88, imageUrl: null },
  ],
}

let storeId: string

test.beforeAll(() => {
  storeId = sql(`SELECT id FROM locations WHERE category = 'store' ORDER BY id ASC LIMIT 1;`)
  expect(storeId).toBeTruthy()
})

test('Notify posts the they-want-you-have cards to the trader and confirms', async ({ page }) => {
  await page.route('**/api/stores/*/trade-matches', (route) =>
    route.fulfill({ json: { success: true, matches: [MATCH] } }),
  )
  // Two upcoming events, out of order: the ping should name the SOONER one.
  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()
  const event = (id: string, name: string, start: string) => ({
    id, locationId: storeId, locationName: 'x', name, type: 'armory', format: 'CC',
    startDate: start, endDate: start, active: true, createdAt: start, updatedAt: start,
  })
  await page.route('**/api/stores/*/events?*', (route) =>
    route.fulfill({ json: { success: true, data: [event('ev-later', 'Road to Nationals', inDays(30)), event('ev-soon', 'Armory', inDays(3))] } }),
  )
  let posted: any = null
  await page.route('**/api/wants/user/*/notify-interest', async (route) => {
    posted = { url: route.request().url(), body: route.request().postDataJSON() }
    await route.fulfill({ json: { success: true, data: { notified: true } } })
  })

  await page.goto(`/stores/${storeId}`)
  await expect(page.getByText('They want — you have')).toBeVisible({ timeout: 15000 })

  const notify = page.getByTestId(`notify-trade-match-${MATCH.userId}`)
  await expect(notify).toContainText(/Notify/i)
  await notify.click()

  await expect(page.getByText('Pinged on Discord', { exact: true })).toBeVisible()
  expect(posted.url).toContain(`/api/wants/user/${MATCH.userId}/notify-interest`)
  // The ping names the exact printing (foil + collector number), not just the card
  expect(posted.body.cards).toEqual([
    { name: 'Dig Up Dinner (SEA015)', quantity: 3, value: 0.38 },
    { name: 'RF Pounamu Amulet (SEA090)', quantity: 1, value: 8.88 },
  ])
  expect(posted.body.totalValue).toBeCloseTo(3 * 0.38 + 8.88, 2)
  // Where it was spotted — otherwise the Discord ping is indistinguishable from a wants-page ping.
  const storeName = sql(`SELECT name FROM locations WHERE id = '${storeId}';`)
  expect(posted.body.source).toMatchObject({ storeId, storeName, eventName: 'Armory' })
  expect(posted.body.source.eventDate).toMatch(/[A-Z][a-z]{2} \d{1,2}, \d{4}/)
})

test('a deduped ping is reported as already-pinged', async ({ page }) => {
  await page.route('**/api/stores/*/trade-matches', (route) =>
    route.fulfill({ json: { success: true, matches: [MATCH] } }),
  )
  await page.route('**/api/wants/user/*/notify-interest', (route) =>
    route.fulfill({ json: { success: true, data: { notified: false } } }),
  )

  await page.goto(`/stores/${storeId}`)
  await page.getByTestId(`notify-trade-match-${MATCH.userId}`).click()

  await expect(page.getByText('Already pinged recently', { exact: true })).toBeVisible()
})
