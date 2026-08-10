// e2e/regression/profile-home-page-setting.spec.ts
// The profile page's Settings tab carries an inline "Home page" selector
// (same preference as /profile/edit's dropdown) that saves immediately.
// The default (empty) choice is /opt — card search — so the explicit list
// hides 'opt' and offers 'volzar' instead.
import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/auth.json' });

test.describe('profile Settings — home page selector', () => {
  test('changes and persists the landing page preference', async ({ page }) => {
    await page.goto('/profile');
    await page.getByRole('tab', { name: 'Settings' }).click();

    const select = page.getByLabel('Home page');
    await expect(select).toBeVisible();
    // /opt is the default (the "" option) — not duplicated as an explicit row.
    await expect(select.locator('option[value=""]')).toHaveText('Default — Card search (/opt)');
    await expect(select.locator('option[value="opt"]')).toHaveCount(0);
    await expect(select.locator('option[value="volzar"]')).toHaveCount(1);

    await select.selectOption('volzar');
    await expect(page.getByText('Home page updated', { exact: true })).toBeVisible();

    // Persisted: fresh load shows the saved value.
    await page.reload();
    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page.getByLabel('Home page')).toHaveValue('volzar');

    // Reset to the default so the seeded e2e user keeps its normal landing.
    await page.getByLabel('Home page').selectOption('');
    await expect(page.getByText('Home page updated', { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page.getByLabel('Home page')).toHaveValue('');
  });
});
