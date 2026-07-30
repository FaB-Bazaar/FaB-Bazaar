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

async function mountBuylist(page: any, tiers: unknown = TIERS) {
  await page.goto('/articles/g4zzA4Ev_Q');
  await page.waitForFunction(() => customElements.get('fab-buylist-block') !== undefined, {
    timeout: 30_000,
  });

  await page.evaluate((t: unknown) => {
    document.querySelectorAll('fab-buylist-block').forEach(n => n.remove());
    const el = document.createElement('fab-buylist-block');
    el.setAttribute('tiers', JSON.stringify(t));
    el.setAttribute('title', 'Teklovossen Buy List');
    (document.querySelector('article') || document.body).prepend(el);
  }, tiers);

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

test('renders legibly in light and dark mode @firefox', async ({ page }) => {
  const host = await mountBuylist(page);

  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await host.screenshot({ path: 'e2e/_buylist-light.png' });

  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await host.screenshot({ path: 'e2e/_buylist-dark.png' });

  // Dark mode must actually repaint the shell, not inherit the light card.
  const background = await host.locator('.buylist').evaluate(
    (el: Element) => getComputedStyle(el).backgroundColor
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

  const fg = parseRgb(await qty.evaluate((el: Element) => getComputedStyle(el).color));
  const bg = parseRgb(
    await host.locator('.buylist').evaluate((el: Element) => getComputedStyle(el).backgroundColor)
  );

  // 4.5:1 is the AA floor for text this size.
  expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
});

/**
 * Author notes and card art. A buy list is a reading surface as much as a
 * checklist — the packages carry explanations, and the images have to be big
 * enough to recognise without clicking.
 */
const ANNOTATED = [
  {
    label: 'The Core',
    note: 'Buy these first.',
    groups: [
      {
        label: 'Adaptive Bases',
        note: 'You can only run 3 copies each across colors — the same-name rule.',
        cards: [
          { printingId: '6CzJM7Ww9N98Rk8fDnqPp', qty: 3, note: 'The single most expensive card here.' },
          { printingId: 'K8BPJPR8tHhc7LTqCCHK6', qty: 3 },
        ],
      },
    ],
  },
];

test('renders author notes at tier, package and card level', async ({ page }) => {
  const host = await mountBuylist(page, ANNOTATED);

  await expect(host.locator('.tier-note')).toHaveText('Buy these first.');
  await expect(host.locator('.group-note')).toContainText('same-name rule');
  await expect(host.locator('.card-note')).toHaveText('The single most expensive card here.');
});

test('omits note elements entirely when the author wrote none', async ({ page }) => {
  const host = await mountBuylist(page);

  await expect(host.locator('.tier-note')).toHaveCount(0);
  await expect(host.locator('.group-note')).toHaveCount(0);
  await expect(host.locator('.card-note')).toHaveCount(0);
});

test('renders card art large enough to recognise', async ({ page }) => {
  const host = await mountBuylist(page);
  const thumb = host.locator('.thumb').first();

  const box = await thumb.boundingBox();
  // Comfortably readable art, not a 32px chip.
  expect(box!.width).toBeGreaterThanOrEqual(52);
});

test('opens a full-size card image on click and closes on Escape', async ({ page }) => {
  const host = await mountBuylist(page);

  await expect(host.locator('.overlay')).toHaveCount(0);
  await host.locator('.thumb-btn').first().click();

  const overlay = host.locator('.overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('img')).toHaveAttribute('alt', /Steel Soul/);

  await page.keyboard.press('Escape');
  await expect(overlay).toHaveCount(0);
});

/**
 * Buy links + unit prices. A buy list must be actionable: every priced row
 * links out to TCGplayer (affiliate-wrapped only with advertising consent),
 * and multi-copy rows show the per-copy price next to the subtotal.
 */
test('links every row with a TCGplayer product to the store in a new tab', async ({ page }) => {
  const host = await mountBuylist(page);

  // All 7 fixture printings carry a tcgplayer_url in the local DB copy.
  const links = host.locator('.buy-link');
  await expect(links).toHaveCount(7);

  const first = links.first();
  await expect(first).toHaveAttribute('target', '_blank');
  expect(await first.getAttribute('href')).toContain('tcgplayer');
});

test('shows the per-copy price on multi-copy rows', async ({ page }) => {
  const host = await mountBuylist(page);
  const firstRow = host.locator('.row').first();

  // 3x Steel Soul Memory @ $7.99 → subtotal $23.97, unit price spelled out.
  await expect(firstRow.locator('.row-price')).toContainText('$23.97');
  await expect(firstRow.locator('.row-unit')).toContainText('$7.99 ea');
});

test('omits the unit price on single-copy rows where it would repeat the subtotal', async ({ page }) => {
  const host = await mountBuylist(page, [
    {
      label: 'One-ofs',
      groups: [{ label: 'Singles', cards: [{ printingId: 'Q7bHNWdWH7BgqnpktCDLb', qty: 1 }] }],
    },
  ]);

  await expect(host.locator('.row-price').first()).toContainText('$7.99');
  await expect(host.locator('.row-unit')).toHaveCount(0);
});

/**
 * The heading attribute. `title` is a global HTML attribute, so authoring
 * <fab-buylist-block title="…"> makes the browser pop a native tooltip over
 * the whole block. The component now takes `heading`, and swallows a legacy
 * `title` (still honoured as the heading) off the host so no tooltip appears.
 */
test('takes its heading from the heading attribute', async ({ page }) => {
  await page.goto('/articles/g4zzA4Ev_Q');
  await page.waitForFunction(() => customElements.get('fab-buylist-block') !== undefined, {
    timeout: 30_000,
  });

  await page.evaluate((t: unknown) => {
    document.querySelectorAll('fab-buylist-block').forEach(n => n.remove());
    const el = document.createElement('fab-buylist-block');
    el.setAttribute('tiers', JSON.stringify(t));
    el.setAttribute('heading', 'Heading Attr Buy List');
    (document.querySelector('article') || document.body).prepend(el);
  }, TIERS);

  const host = page.locator('fab-buylist-block');
  await expect(host.locator('.title')).toHaveText('Heading Attr Buy List', { timeout: 30_000 });
  expect(await host.getAttribute('title')).toBeNull();
});

test('honours a legacy title attribute as the heading but strips it from the host', async ({ page }) => {
  const host = await mountBuylist(page); // helper mounts with title="Teklovossen Buy List"

  await expect(host.locator('.title')).toHaveText('Teklovossen Buy List');
  // Captured as the heading, then removed so the browser shows no tooltip.
  await expect.poll(() => host.getAttribute('title')).toBeNull();
});

/**
 * Copy / export. The component doc says a buy list is meant to be taken
 * somewhere — copy the structured list as text, or bare "<qty> <name>" lines
 * for TCGplayer's Mass Entry page.
 */
test.describe('copy and export', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('copies the structured list as plain text', async ({ page }) => {
    const host = await mountBuylist(page);

    await host.locator('.copy-btn', { hasText: 'Copy list' }).click();
    await expect(host.locator('.copy-status')).toContainText('copied', { ignoreCase: true });

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain('Teklovossen Buy List ($');
    expect(clip).toContain('Steel Soul Set');
    // Card lines carry quantity, collector number and money.
    expect(clip).toMatch(/3x .+ \(EVO\d+\) — \$\d/);
  });

  test('copies bare quantity-name lines for TCGplayer Mass Entry', async ({ page }) => {
    const host = await mountBuylist(page);

    await host.locator('.copy-btn', { hasText: 'Mass Entry' }).click();
    await expect(host.locator('.copy-status')).toContainText('copied', { ignoreCase: true });

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    const lines = clip.split('\n');
    // 7 fixture rows, every line "<qty> <name>", no headers and no prices.
    expect(lines).toHaveLength(7);
    for (const line of lines) {
      expect(line).toMatch(/^\d+ \S/);
    }
    expect(clip).not.toContain('$');
  });
});

/**
 * Server-rendered pricing. The page pre-rolls the buy list at render time and
 * hands it to the component, so the article's core content paints immediately
 * (and is crawlable) instead of waiting on a client fetch. The fetch still
 * runs afterwards to layer in the signed-in reader's ownership.
 */
test('shows a fully priced list even when the rollup API is unreachable', async ({ page }) => {
  await page.route('**/api/buylist/rollup', route => route.abort());

  await page.goto('/heroes/g4zzA4Ev_Q');
  const host = page.locator('fab-buylist-block').first();

  // Priced from the server-rendered payload, no API round-trip needed.
  await expect(host.locator('.total-cost')).toContainText('$', { timeout: 30_000 });
  await expect(host.locator('.row').first()).toBeVisible();
  await expect(host.locator('.state')).toHaveCount(0);
});

/**
 * Footer transparency + resilience: the as-of date makes price staleness
 * self-evident, the ·M flag gets a visible legend (its explanation used to be
 * hover-only), a failed fetch offers a retry, and the sign-in nudge is an
 * actual link.
 */
test('shows when the prices were last refreshed', async ({ page }) => {
  const host = await mountBuylist(page);

  // Local DB prices carry a real price_updated_at; exact date varies by copy.
  await expect(host.locator('.prices-as-of')).toContainText(/prices as of/i);
  await expect(host.locator('.prices-as-of')).toContainText(/\d{4}/);
});

test('explains the ·M market-price flag with a visible legend', async ({ page }) => {
  // No local printing is market-priced-only, so flip one in the API response.
  await page.route('**/api/buylist/rollup', async route => {
    const response = await route.fetch();
    const body = await response.json();
    const card = body.data.rollup.tiers[0].groups[0].cards[0];
    card.priceIsFallback = true;
    await route.fulfill({ response, json: body });
  });

  const host = await mountBuylist(page);

  await expect(host.locator('.fallback-flag').first()).toBeVisible();
  await expect(host.locator('.legend')).toContainText('TCG Market');
});

test('hides the legend when no row is market-priced', async ({ page }) => {
  const host = await mountBuylist(page);

  await expect(host.locator('.legend')).toHaveCount(0);
});

test('offers a retry when pricing fails, which recovers on click', async ({ page }) => {
  let broken = true;
  await page.route('**/api/buylist/rollup', route => {
    if (broken) return route.abort();
    return route.fallback();
  });

  await page.goto('/articles/g4zzA4Ev_Q');
  await page.waitForFunction(() => customElements.get('fab-buylist-block') !== undefined, {
    timeout: 30_000,
  });
  await page.evaluate((t: unknown) => {
    document.querySelectorAll('fab-buylist-block').forEach(n => n.remove());
    const el = document.createElement('fab-buylist-block');
    el.setAttribute('tiers', JSON.stringify(t));
    el.setAttribute('heading', 'Retry Check');
    (document.querySelector('article') || document.body).prepend(el);
  }, TIERS);

  const host = page.locator('fab-buylist-block');
  await expect(host.locator('.state.error')).toBeVisible({ timeout: 30_000 });

  broken = false;
  await host.locator('.retry-btn').click();

  await expect(host.locator('.title')).toHaveText('Retry Check', { timeout: 30_000 });
  await expect(host.locator('.row').first()).toBeVisible();
});

test('links the signed-out nudge to the login page', async ({ page }) => {
  const host = await mountBuylist(page);

  const link = host.locator('.note a');
  await expect(link).toContainText(/sign in/i);
  expect(await link.getAttribute('href')).toContain('/login');
});

/**
 * Check-off boxes. A buy list is worked through over days — each row carries
 * a checkbox persisted in localStorage (keyed by list identity), so progress
 * survives leaving the page.
 */
test('lets the reader check off a row, dimming it', async ({ page }) => {
  const host = await mountBuylist(page);

  const box = host.locator('.check-box').first();
  await expect(box).not.toBeChecked();

  await box.check();

  await expect(box).toBeChecked();
  await expect(host.locator('.row').first()).toHaveClass(/checked/);
});

test('remembers checked rows across a re-mount of the same list', async ({ page }) => {
  const host = await mountBuylist(page);
  await host.locator('.check-box').first().check();
  await expect(host.locator('.row').first()).toHaveClass(/checked/);

  // Same tiers → same storage identity → state survives.
  const remounted = await mountBuylist(page);
  await expect(remounted.locator('.check-box').first()).toBeChecked();

  // And unchecking clears it.
  await remounted.locator('.check-box').first().uncheck();
  const again = await mountBuylist(page);
  await expect(again.locator('.check-box').first()).not.toBeChecked();
});

test('lays the tier note on its own line below the tier heading', async ({ page }) => {
  const host = await mountBuylist(page, ANNOTATED);

  const title = await host.locator('.tier-title').boundingBox();
  const note = await host.locator('.tier-note').boundingBox();

  // Below the heading, not squeezed into the same row as the total.
  expect(note!.y).toBeGreaterThan(title!.y + title!.height - 2);
  // And starting at the left edge, aligned with the heading.
  expect(Math.abs(note!.x - title!.x)).toBeLessThan(4);
});
