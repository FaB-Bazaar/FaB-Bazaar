import { test, expect } from '@playwright/test'

/**
 * The printing detail page must show TCG *low* — the same field the search grid
 * (ImagesView) renders — not TCG market. Showing market made a card appear to
 * change price by ~50% just by clicking through from search to its detail page.
 *
 * Fixture: MST236 Shadowrealm Horror. Both English printings have tcg_low and
 * tcg_market that diverge sharply, so asserting on one genuinely excludes the
 * other. Prices are read from the API at run time rather than hard-coded, so a
 * nightly repricing can't turn this test red.
 */

const NON_FOIL = 'HnPc9njwNrJh9Gq7RFWJ7'
const RAINBOW_FOIL = 'Mgkd9dk9Wk7jhrbj8WNpH'

type Prices = { low: number; market: number }

async function fetchPrices(request: any): Promise<Record<string, Prices>> {
  const res = await request.get('/api/printings/search?q=shadowrealm%20horror&limit=20')
  expect(res.ok()).toBeTruthy()
  const body = await res.json()

  const found: Record<string, Prices> = {}
  const walk = (node: any) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (node && typeof node === 'object') {
      const id = node.printing_id
      if ((id === NON_FOIL || id === RAINBOW_FOIL) && node.tcg_low != null) {
        found[id] = { low: Number(node.tcg_low), market: Number(node.tcg_market) }
      }
      Object.values(node).forEach(walk)
    }
  }
  walk(body)

  // Guard the fixture itself: if the two fields ever converge, the assertions
  // below stop proving anything and the test must be pointed at another card.
  for (const id of [NON_FOIL, RAINBOW_FOIL]) {
    expect(found[id], `fixture printing ${id} missing from search results`).toBeTruthy()
    expect(
      Math.abs(found[id].low - found[id].market),
      `fixture printing ${id} needs divergent low/market to discriminate`
    ).toBeGreaterThan(0.5)
  }
  return found
}

test('Buy on TCGplayer rail shows tcg_low, not tcg_market', async ({ page, request }) => {
  const prices = await fetchPrices(request)
  const { low, market } = prices[NON_FOIL]

  await page.goto(`/printing/${NON_FOIL}`)

  const buyLink = page.getByTitle(/Buy .* on TCGplayer/i)
  await expect(buyLink).toBeVisible()

  await expect(buyLink).toContainText(`$${low.toFixed(2)}`)
  await expect(buyLink).not.toContainText(`$${market.toFixed(2)}`)
})

test('All Printings chips show tcg_low, not tcg_market', async ({ page, request }) => {
  const prices = await fetchPrices(request)

  await page.goto(`/printing/${NON_FOIL}`)

  const printingsPanel = page.locator('div').filter({ hasText: /^All Printings/ }).first()
  await expect(printingsPanel).toBeVisible()

  // Both English printings are listed in the panel; each chip must carry its own low.
  for (const id of [NON_FOIL, RAINBOW_FOIL]) {
    const { low, market } = prices[id]
    await expect(page.getByText(`$${low.toFixed(2)}`, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(`$${market.toFixed(2)}`, { exact: true })).toHaveCount(0)
  }
})
