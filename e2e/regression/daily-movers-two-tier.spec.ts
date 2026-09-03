/**
 * /daily two-tier page — "Your movers" + "Around the market".
 *
 * Anonymous flow reads the real pipeline data already in the local DB (the
 * market tier is not user-specific). The signed-in flow seeds a deterministic
 * mover: an API-created binder holding 4 copies of a printing, plus a
 * daily_movers row at a far-future as_of_date (2099-01-05) so it becomes the
 * "latest" snapshot for the duration of the test — deleted in afterAll.
 *
 * NOTE: the anonymous describe must run FIRST — while the 2099 seed row
 * exists, the latest snapshot contains only the seeded card.
 */

import { test, expect } from '@playwright/test'
import { execSync } from 'child_process'

const TEST_AS_OF = '2099-01-05'

const sql = (query: string) =>
  execSync(`docker exec fabbazaar-postgres psql -U fabbazaar -d fabbazaar -t -A -c "${query}"`)
    .toString()
    .trim()

test.use({ viewport: { width: 1280, height: 900 } })

test.describe('anonymous viewer — market tier only', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('sees the market view and a sign-in CTA, no personal tier', async ({ page }) => {
    await page.goto('/daily')

    await expect(page.getByRole('heading', { name: 'Daily Movers' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Around the market' })).toBeVisible()

    // Real pipeline data renders at least one signal section with tiles
    await expect(
      page.getByRole('heading', { name: /Top Gainers|Top Decliners|Breakouts|Steady Risers/ }).first()
    ).toBeVisible()

    // No personal tier for anonymous visitors
    await expect(page.getByText(/in your collection/)).toHaveCount(0)
  })
})

test.describe('signed-in — seeded personal mover', () => {
  test.use({ storageState: 'e2e/auth.json' })

  let binderId: string
  let printingId: string
  let displayName: string

  test.beforeAll(async ({ request }) => {
    // A real printing with an image, joined for its display name
    const row = sql(`
      SELECT p.printing_id || '|' || c.display_name
      FROM printings p JOIN cards c ON c.card_unique_id = p.card_unique_id
      WHERE p.image_url IS NOT NULL AND p.tcgplayer_url IS NOT NULL
      ORDER BY p.printing_id ASC LIMIT 1;`)
    ;[printingId, displayName] = row.split('|')
    expect(printingId).toBeTruthy()

    const suffix = Date.now().toString(36)
    const res = await request.post('/api/binders', {
      data: { name: `E2E Daily ${suffix}`, slug: `e2e-daily-${suffix}` },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    binderId = body.binder?._id || body.binder?.id || body.data?._id
    expect(binderId).toBeTruthy()

    const addRes = await request.post(`/api/binders/${binderId}/cards`, {
      data: { printingId, quantity: 4 },
    })
    expect(addRes.ok()).toBeTruthy()

    // +$2.50 gainer × 4 owned copies = +$10.00 hero stat
    sql(`
      INSERT INTO daily_movers
        (as_of_date, signal_type, printing_id, p_at_signal, ref_price,
         dollar_change, pct_change, rank_in_signal)
      VALUES
        ('${TEST_AS_OF}', 'top_gainer', '${printingId}', 12.50, 10.00, 2.50, 25.00, 1);`)
  })

  test.afterAll(async ({ request }) => {
    sql(`DELETE FROM daily_movers WHERE as_of_date = '${TEST_AS_OF}';`)
    if (binderId) await request.delete(`/api/binders/${binderId}`)
  })

  test('hero stat shows dollar impact; sparse day renders the merged list', async ({ page }) => {
    await page.goto('/daily')

    // Hero stat: dollarChange × quantity, colored positive
    await expect(page.getByText('+$10.00', { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/across 1 mover in your collection/)).toBeVisible()

    // Sparse (<6 movers) → merged row with signal badge + ownership context
    await expect(page.getByText('Gainer', { exact: true })).toBeVisible()
    await expect(page.getByText(/on your 4 copies in E2E Daily/).first()).toBeVisible()

    // The card links to its printing page
    await expect(
      page.getByRole('link', { name: displayName, exact: true }).first()
    ).toBeVisible()

    // Market tier exists but the owned printing is filtered out of it — the
    // 2099 snapshot contains ONLY the seeded card, so no market tile renders.
    await expect(page.getByRole('heading', { name: 'Around the market' })).toBeVisible()
  })
})
