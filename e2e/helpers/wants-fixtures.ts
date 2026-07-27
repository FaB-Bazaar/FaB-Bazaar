// e2e/helpers/wants-fixtures.ts
//
// Deterministic mock data + route-mocking helpers for the /wants and /wants/[userId] pages.
// Use these to write characterization tests without mutating the real DB.

import type { Page, Route } from '@playwright/test'

/**
 * Pre-seed localStorage so the cookie consent banner doesn't render.
 * Call from a beforeEach before page.goto — its fixed-bottom z-50 panel
 * intercepts clicks on the shared list's slide-in cart footer otherwise.
 */
export async function dismissCookieBanner(page: Page) {
  // The provider only treats consent as given when BOTH keys are present.
  await page.addInitScript(() => {
    localStorage.setItem('cookieConsent', 'true')
    localStorage.setItem(
      'cookieConsentOptions',
      JSON.stringify({ necessary: true, functional: true, analytics: true, advertising: true }),
    )
  })
}

export type FixtureCard = {
  id: string
  cardId: string
  name: string
  quantity: number
  priority: 'high' | 'medium' | 'low'
  printingDetails: {
    printing_id: string
    card_unique_id: string
    display_name?: string
    name?: string
    set?: string
    rarity?: string
    foiling?: string
    color?: string
    collector_number?: string
    type_text?: string
    tcg_low?: number
    tcg_market?: number
    image_url?: string
  }
}

export const TEST_USER_ID = 'test-user-id-pinned'

// Three cards with deliberately different rarity/foiling/set/priority axes so filter tests
// can assert distinct counts.
export const FIXTURE_CARDS: FixtureCard[] = [
  {
    id: 'pr-bravo-001',
    cardId: 'card-bravo',
    name: 'Bravo, Showstopper',
    quantity: 1,
    priority: 'high',
    printingDetails: {
      printing_id: 'pr-bravo-001',
      card_unique_id: 'card-bravo',
      display_name: 'Bravo, Showstopper',
      name: 'bravo, showstopper',
      set: 'wtr',
      rarity: 'F',
      foiling: 'C',
      collector_number: 'WTR001',
      type_text: 'Hero — Guardian Earth',
      tcg_low: 80,
      tcg_market: 90,
    },
  },
  {
    id: 'pr-cnv-002',
    cardId: 'card-cnv',
    name: 'Command and Conquer',
    quantity: 2,
    priority: 'medium',
    printingDetails: {
      printing_id: 'pr-cnv-002',
      card_unique_id: 'card-cnv',
      display_name: 'Command and Conquer',
      name: 'command and conquer',
      set: 'cru',
      rarity: 'M',
      foiling: 'R',
      collector_number: 'CRU002',
      type_text: 'Attack Action — Warrior',
      tcg_low: 25,
      tcg_market: 30,
    },
  },
  {
    id: 'pr-spike-003',
    cardId: 'card-spike',
    name: 'Spike Bringer',
    quantity: 3,
    priority: 'low',
    printingDetails: {
      printing_id: 'pr-spike-003',
      card_unique_id: 'card-spike',
      display_name: 'Spike Bringer',
      name: 'spike bringer',
      set: 'mon',
      rarity: 'R',
      foiling: 'S',
      collector_number: 'MON003',
      type_text: 'Equipment — Weapon',
      tcg_low: 5,
      tcg_market: 6,
    },
  },
]

function buildWantsListResponse(cards: FixtureCard[], userId = TEST_USER_ID) {
  return {
    success: true,
    wantsList: {
      _id: userId,
      userId,
      name: 'Test Wants List',
      isPublic: true,
      cards,
      discordUsername: 'tester',
      discordId: 'discord-123',
      createdAt: new Date('2026-01-01').toISOString(),
      updatedAt: new Date('2026-04-01').toISOString(),
    },
  }
}

/**
 * Mock GET /api/wants (owner page). Returns the given cards on every fetch.
 * Pass an empty array to test the zero-cards empty state.
 */
export async function mockOwnerWants(page: Page, cards: FixtureCard[] = FIXTURE_CARDS) {
  await page.route('**/api/wants?**', async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildWantsListResponse(cards)),
    })
  })
}

/**
 * Mock GET /api/wants/user/[userId] (shared page) and /api/users/find.
 * For the shared page test.
 */
export async function mockSharedWants(
  page: Page,
  userId: string,
  cards: FixtureCard[] = FIXTURE_CARDS,
) {
  // The shared page calls fetchMetadata() on mount; if this hangs the
  // loading spinner never clears. Mock it with an empty payload.
  await page.route('**/api/metadata', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    })
  })
  await page.route(`**/api/wants/user/${userId}**`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildWantsListResponse(cards, userId)),
    })
  })
  await page.route(`**/api/users/find**`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        user: { id: userId, username: 'tester', name: 'Tester', discordUsername: 'tester' },
      }),
    })
  })
}

/**
 * Mock the printing-swap-dialog search endpoint to return one alternate printing.
 * Used by the swap test to drive the dialog without hitting the real search API.
 */
export async function mockPrintingSearch(page: Page, alternatePrinting: any) {
  await page.route('**/api/printings/search**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { printings: [alternatePrinting], total: 1 },
      }),
    })
  })
}
