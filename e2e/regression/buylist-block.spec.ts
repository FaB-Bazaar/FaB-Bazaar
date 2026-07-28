import { test, expect } from '@playwright/test';

/**
 * fab-buylist-block against the real dev server: real web-component bundle,
 * real /api/buylist/rollup, real printing prices from the local DB copy.
 *
 * The element is injected into a live article page rather than authored into a
 * stored article, so the test mutates nothing.
 */

const TIERS = [
  {
    label: 'The Core',
    groups: [
      {
        label: 'Steel Soul Set',
        cards: [
          { printingId: 'Q7bHNWdWH7BgqnpktCDLb', qty: 3 },
          { printingId: 'BQtw9MRfNkpftDdRrddTT', qty: 3 },
          { printingId: 'gB6NK8RKBJLcpKfNfcRhd', qty: 3 },
          { printingId: 'dkDjmgdTJ6TP7cqkq6KBK', qty: 3 },
        ],
      },
      {
        label: 'Adaptive Bases',
        cards: [
          { printingId: '6CzJM7Ww9N98Rk8fDnqPp', qty: 3 },
          { printingId: 'K8BPJPR8tHhc7LTqCCHK6', qty: 3 },
        ],
      },
    ],
  },
  {
    label: 'Flex & Tech',
    groups: [
      {
        label: 'Mage Set',
        cards: [{ printingId: 'pCggdLw6DLhjTrzgLzbnH', qty: '1-2' }],
      },
    ],
  },
];

async function mountBuylist(page: any) {
  await page.goto('/articles/g4zzA4Ev_Q');
  await page.waitForFunction(() => customElements.get('fab-buylist-block') !== undefined, {
    timeout: 30_000,
  });

  await page.evaluate((tiers: unknown) => {
    document.querySelectorAll('fab-buylist-block').forEach(n => n.remove());
    const el = document.createElement('fab-buylist-block');
    el.setAttribute('tiers', JSON.stringify(tiers));
    el.setAttribute('title', 'Teklovossen Buy List');
    (document.querySelector('article') || document.body).prepend(el);
  }, TIERS);

  const host = page.locator('fab-buylist-block');
  await expect(host.locator('.title')).toHaveText('Teklovossen Buy List', { timeout: 30_000 });
  return host;
}

test('prices a grouped buy list with derived group quantities and a range total', async ({ page }) => {
  const host = await mountBuylist(page);

  // Grand total spans the 1-2x range: $198.99 min, $203.64 max.
  await expect(host.locator('.total-cost')).toContainText('–');
  await expect(host.locator('.total-cost')).toContainText('$198.99');

  // Uniform groups surface their shared quantity on the header.
  await expect(host.locator('.group-qty').first()).toHaveText('3x');
  // A shared range renders as a range.
  await expect(host.locator('.group-qty').last()).toHaveText('1-2x');

  // Every card row is visible at once — nothing hidden behind a carousel.
  await expect(host.locator('.row')).toHaveCount(7);
});

test('collapses a package without losing its total', async ({ page }) => {
  const host = await mountBuylist(page);
  const firstGroup = host.locator('.group-header').first();

  await expect(host.locator('.row')).toHaveCount(7);
  await expect(firstGroup).toHaveAttribute('aria-expanded', 'true');

  await firstGroup.click();

  await expect(firstGroup).toHaveAttribute('aria-expanded', 'false');
  await expect(host.locator('.row')).toHaveCount(3);
  // The group's cost stays on the collapsed header.
  await expect(firstGroup.locator('.group-cost')).toContainText('$99.39');
});

test('prompts a signed-out reader to sign in and offers no wants button', async ({ page }) => {
  const host = await mountBuylist(page);

  await expect(host.locator('.note')).toContainText('Sign in');
  await expect(host.locator('.add-btn')).toHaveCount(0);
  // No ownership column for anonymous readers.
  await expect(host.locator('.own-pill')).toHaveCount(0);
});

test('renders legibly in light and dark mode', async ({ page }) => {
  const host = await mountBuylist(page);

  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await host.screenshot({ path: 'e2e/_buylist-light.png' });

  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await host.screenshot({ path: 'e2e/_buylist-dark.png' });

  // Dark mode must actually repaint the shell, not inherit the light card.
  const background = await host.locator('.buylist').evaluate(
    el => getComputedStyle(el).backgroundColor
  );
  expect(background).toBe('rgb(15, 23, 42)');
});

/** Relative luminance contrast ratio, per WCAG 2.1 SC 1.4.3. */
function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const lum = (rgb: [number, number, number]) => {
    const [r, g, b] = rgb.map(v => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

function parseRgb(value: string): [number, number, number] {
  const m = value.match(/\d+/g)!;
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}

test('keeps the per-row quantity readable in dark mode', async ({ page }) => {
  const host = await mountBuylist(page);
  await page.evaluate(() => document.documentElement.classList.add('dark'));

  const qty = host.locator('.row-qty').first();
  await expect(qty).toHaveText('3x');

  const fg = parseRgb(await qty.evaluate(el => getComputedStyle(el).color));
  const bg = parseRgb(
    await host.locator('.buylist').evaluate(el => getComputedStyle(el).backgroundColor)
  );

  // 4.5:1 is the AA floor for text this size.
  expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
});
