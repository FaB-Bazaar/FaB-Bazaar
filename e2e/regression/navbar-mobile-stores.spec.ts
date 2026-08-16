import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/auth.json' });

test('@mobile signed-in mobile menu has an expandable Your Stores section', async ({ page }) => {
  await page.goto('/decks');
  await page.waitForLoadState('networkidle');
  await page.locator("header .md\\:hidden button").first().click();

  const stores = page.getByRole('button', { name: /your stores/i });
  await expect(stores).toBeVisible();
  await stores.click();

  await expect(page.getByRole('link', { name: 'My Stores' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse Stores' })).toBeVisible();

  await page.getByRole('link', { name: 'My Stores' }).click();
  await expect(page).toHaveURL(/\/stores$/);
  await expect(page.getByRole('heading', { name: 'My Stores' })).toBeVisible();
});
