import { test, expect } from '@playwright/test';

// Decks to Beat opens on the current month when ANY format has featured decks
// in it — even if the default tab (Classic Constructed) has none yet. It only
// reverts to an earlier month when the current month is empty in every format.
// Local DB state this relies on: Aug 2026 has Silver Age decks only; CC's
// latest is Jul 2026.
test('defaults to the current month when another format has decks in it', async ({ page }) => {
  const now = new Date();
  const yyyyMm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Guard: the cross-format latest month must be the current month, or this
  // scenario is vacuous — fail loudly rather than pass on stale data.
  const latest = await (await page.request.get('/api/decks/featured-latest-month')).json();
  expect(`${latest.data.year}-${String(latest.data.month).padStart(2, '0')}`).toBe(yyyyMm);

  await page.goto('/decks/to-beat');
  await page.waitForResponse((r) => r.url().includes('/api/decks/featured-latest-month'));

  await expect(page.locator('input[type="month"]')).toHaveValue(yyyyMm);
  const monthName = now.toLocaleString('en-US', { month: 'long' }).toLowerCase();
  await expect(page).toHaveURL(new RegExp(`date=${monthName}${now.getFullYear()}`));
});
