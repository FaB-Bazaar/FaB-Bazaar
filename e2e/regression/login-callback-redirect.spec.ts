// e2e/regression/login-callback-redirect.spec.ts
// Login flow must preserve the page the user was trying to visit:
// - /auth/login?callbackUrl=… carries the target into the Discord form
// - the navbar login button carries the current path
// - a private binder's access-denied screen offers sign-in with a callback
// All tests run UNAUTHENTICATED (no storageState).
import { test, expect } from '@playwright/test';

// Any private binder in the local dev DB (queried at spec-writing time;
// anonymous viewers get the access-denied screen regardless of owner).
const PRIVATE_BINDER_ID = '6871e2eab2b77be5c1c6f704';

test.describe('login callbackUrl preservation', () => {
  test('login page carries callbackUrl into the sign-in form', async ({ page }) => {
    await page.goto('/auth/login?callbackUrl=%2Fbinder%2Fabc123');
    const hidden = page.locator('form input[name="callbackUrl"]');
    await expect(hidden).toHaveValue('/binder/abc123');
  });

  test('login page without callbackUrl submits no target', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByRole('button', { name: /continue with discord/i })).toBeVisible();
    await expect(page.locator('form input[name="callbackUrl"]')).toHaveCount(0);
  });

  test('navbar signed-out CTA carries the current path', async ({ page }) => {
    await page.goto('/browse');
    // The signed-out navbar CTA (user icon, formerly /signup) must point at
    // login with the current page as callback.
    const loginLink = page.locator('a[href^="/auth/login"]').first();
    await expect(loginLink).toHaveAttribute(
      'href',
      `/auth/login?callbackUrl=${encodeURIComponent('/browse')}`,
    );
  });

  test('private binder access-denied screen offers sign-in with callback', async ({ page }) => {
    await page.goto(`/binder/${PRIVATE_BINDER_ID}`);
    await expect(page.getByText('Access Denied')).toBeVisible();
    const signIn = page.getByRole('link', { name: /sign in/i });
    await expect(signIn).toHaveAttribute(
      'href',
      `/auth/login?callbackUrl=${encodeURIComponent(`/binder/${PRIVATE_BINDER_ID}`)}`,
    );
  });
});
