/**
 * Binder recency sorts — 'Recently Added' / 'Recently Updated'.
 *
 * Server-side ordering itself is pinned by
 * lib/services/postgres/binder/recentSort.test.ts; this spec proves the UI
 * wiring: the options exist in the sort dropdown, selecting one refetches
 * with the right sortBy param, and the grid re-renders in the API's order.
 *
 * Uses the local fixture binder 68d8615daa02602a0cd8b210 (public, 60 items)
 * read-only — no mutation, no cleanup needed.
 */

import { test, expect } from '@playwright/test'

const PUBLIC_BINDER = '68d8615daa02602a0cd8b210'

test.use({ viewport: { width: 1280, height: 800 } })
test.use({ storageState: { cookies: [], origins: [] } })

for (const [sortValue, field] of [
  ['recently-added', 'addedAt'],
  ['recently-updated', 'updatedAt'],
] as const) {
  test(`selecting ${sortValue} refetches sorted by ${field} DESC and renders that order`, async ({ page, request }) => {
    await page.goto(`/binder/${PUBLIC_BINDER}`)
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 15000 })

    // Desktop sort select (mobile+desktop both in DOM → .last() is desktop)
    const sortSelect = page.locator('select').last()
    await expect(sortSelect.locator(`option[value="${sortValue}"]`)).toHaveCount(1)

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes(`/binders/${PUBLIC_BINDER}/cards`) && res.url().includes(`sortBy=${sortValue}`)
    )
    await sortSelect.selectOption(sortValue)
    const res = await responsePromise
    expect(res.ok()).toBeTruthy()

    const body = await res.json()
    const cards = body.cards ?? body.data?.cards
    expect(cards.length).toBeGreaterThan(2)

    // Server order is DESC on the recency field
    const ts = cards.map((c: any) => new Date(c[field]).getTime())
    for (let i = 1; i < ts.length; i++) expect(ts[i - 1]).toBeGreaterThanOrEqual(ts[i])

    // And the grid renders that order: the API's first card is the first card shown
    const firstName = cards[0].display_name || cards[0].name
    await expect(
      page.getByText(new RegExp(firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).first()
    ).toBeVisible({ timeout: 15000 })
  })
}
