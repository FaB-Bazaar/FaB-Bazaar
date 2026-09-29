/**
 * A card image whose load fails once (a dropped request when a view swaps in
 * dozens of images — seen going Brew → Cards on the deck page) used to stay a
 * broken-image icon with its alt text until a page refresh. FoilCardImage now
 * retries once, then falls back to the cardback. Fixture: local Midrange Maxx.
 */
import { test, expect } from '@playwright/test'

const DECK = 'TofxuKKxD0ESwVR93b5AC'
test.use({ storageState: 'e2e/auth.json', viewport: { width: 1440, height: 1000 } })

test('a card image that fails to load once is retried and shows', async ({ page }) => {
  const deck = (await (await page.request.get(`/api/decks/${DECK}`)).json()).data
  const victim: string = deck.maindeck[0].printingDetails.image_url
  let failed = 0
  await page.route(u => u.href.startsWith(victim) && !u.search.includes('retry'), route => { failed++; return route.abort('connectionreset') })

  await page.goto(`/decks/${DECK}`)
  const img = page.locator(`main img[src^="${victim}"]`).first()
  await expect.poll(() => failed, { timeout: 60000 }).toBeGreaterThan(0)
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0).catch(() => false), { timeout: 20000 }).toBe(true)
  expect(await img.getAttribute('src')).toContain('retry=1')
})

test('an image that keeps failing ends on the cardback, never a broken icon', async ({ page }) => {
  const deck = (await (await page.request.get(`/api/decks/${DECK}`)).json()).data
  const victim: string = deck.maindeck[0].printingDetails.image_url
  await page.route(u => u.href.startsWith(victim), route => route.abort('connectionreset'))
  await page.goto(`/decks/${DECK}`)
  await expect(page.locator('main img[src="/cardback.webp"]').first()).toBeAttached({ timeout: 60000 })
  const broken = await page.evaluate((v) => [...document.querySelectorAll('main img')].filter((i: any) => i.getAttribute('src')?.startsWith(v) && i.complete && i.naturalWidth === 0).length, victim)
  expect(broken).toBe(0)
})
