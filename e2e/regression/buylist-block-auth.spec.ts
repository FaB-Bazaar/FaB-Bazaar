import { test, expect } from '@playwright/test';

/**
 * fab-buylist-block, signed in — the ownership overlay path.
 *
 * Exercises the authenticated branch of /api/buylist/rollup:
 * getOwnedCountsByCardUniqueId, the per-group ownership pills, and the
 * "add missing to Wants" action. Uses the seeded superadmin session.
 */

test.use({ storageState: 'e2e/auth.json' });

const TIERS = [
  {
    label: 'The Core',
    groups: [
      {
        label: 'Steel Soul Set',
        cards: [
          { printingId: 'Q7bHNWdWH7BgqnpktCDLb', qty: 3 },
          { printingId: 'BQtw9MRfNkpftDdRrddTT', qty: 3 },
        ],
      },
    ],
  },
];

/**
 * The seeded user owns 3 copies of each card above, so TIERS asks for exactly
 * what they already have. SHORTFALL_TIERS asks for more than they own, which is
 * how the "still needed" branch gets exercised.
 */
const SHORTFALL_TIERS = [
  {
    label: 'The Core',
    groups: [
      {
        label: 'Steel Soul Set',
        cards: [
          { printingId: 'Q7bHNWdWH7BgqnpktCDLb', qty: 5 },
          { printingId: 'BQtw9MRfNkpftDdRrddTT', qty: 5 },
        ],
      },
    ],
  },
];

async function mountBuylist(page: any, tiers: unknown = TIERS) {
  await page.goto('/articles/g4zzA4Ev_Q');
  await page.waitForFunction(() => customElements.get('fab-buylist-block') !== undefined, {
    timeout: 30_000,
  });

  await page.evaluate((t: unknown) => {
    document.querySelectorAll('fab-buylist-block').forEach(n => n.remove());
    const el = document.createElement('fab-buylist-block');
    el.setAttribute('tiers', JSON.stringify(t));
    el.setAttribute('title', 'Owned Check');
    (document.querySelector('article') || document.body).prepend(el);
  }, tiers);

  const host = page.locator('fab-buylist-block');
  await expect(host.locator('.title')).toHaveText('Owned Check', { timeout: 30_000 });
  return host;
}

test('shows the ownership overlay to a signed-in reader', async ({ page }) => {
  const host = await mountBuylist(page);

  // The signed-in note replaces the sign-in prompt.
  await expect(host.locator('.note')).not.toContainText('Sign in');
  await expect(host.locator('.note')).toContainText('any printing');

  // A per-group ownership pill appears, carrying a glyph as well as colour.
  const pill = host.locator('.own-pill').first();
  await expect(pill).toBeVisible();
  await expect(pill).toContainText('own');
  await expect(pill).toContainText(/[✓✗◐]/);
});

test('marks a fully-owned package complete and offers no wants action', async ({ page }) => {
  const host = await mountBuylist(page);

  // Owns 3 of each, list wants 3 of each — nothing left to buy.
  await expect(host.locator('.own-pill').first()).toHaveText('✓ own 6 / 6');
  await expect(host.locator('.add-btn')).toHaveCount(0);
  // With nothing outstanding the "you still need" line is suppressed.
  await expect(host.locator('.total-need')).toHaveCount(0);
});

test('offers a wants action sized to what is actually missing', async ({ page }) => {
  const host = await mountBuylist(page, SHORTFALL_TIERS);

  // Wants 5 of each, owns 3 of each → 2 cards short.
  await expect(host.locator('.own-pill').first()).toHaveText('◐ own 6 / 10');
  await expect(host.locator('.total-need')).toContainText('you still need');

  const button = host.locator('.add-btn');
  await expect(button).toBeVisible();
  await expect(button).toContainText('Add 2 missing to Wants');
});

test('reports success after adding the missing cards to wants', async ({ page }) => {
  const host = await mountBuylist(page, SHORTFALL_TIERS);

  await host.locator('.add-btn').click();

  const status = host.locator('.add-status');
  await expect(status).toBeVisible({ timeout: 20_000 });
  await expect(status).toContainText('Added 2 cards to your wants');
  await expect(status).not.toHaveClass(/error/);
});
