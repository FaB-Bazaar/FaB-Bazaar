/**
 * generateUniqueBinderSlug must ALWAYS terminate.
 *
 * 2026-08-26 prod outage: binder slugs are capped at 20 chars. When the base
 * slug was already exactly 20 chars AND already taken, every "-2", "-3", …
 * candidate was re-truncated back to the same taken string, so the
 * synchronous `while (taken)` loop never exited. Node's event loop was
 * pinned at 100% CPU for ~3.7 hours (every request 502'd) until the
 * container was restarted by hand. Trigger: a user importing a Fabrary CSV
 * twice on the same day (`csv-import-YYYY-MM-DD` is 21 chars → truncated).
 *
 * If this file ever HANGS instead of failing, the loop has regressed.
 */

import { describe, it, expect } from 'vitest';
import { generateUniqueBinderSlug, slugifyBinderName } from './utils';

const MAX = 20;

describe('generateUniqueBinderSlug', () => {
  it('appends -2, -3 when a short base slug is taken (existing behaviour)', () => {
    expect(generateUniqueBinderSlug('My Binder', [])).toBe('my-binder');
    expect(generateUniqueBinderSlug('My Binder', ['my-binder'])).toBe('my-binder-2');
    expect(generateUniqueBinderSlug('My Binder', ['my-binder', 'MY-BINDER-2'])).toBe('my-binder-3');
  });

  it('returns an unused slug within the 20-char cap when the 20-char base is already taken (prod hang repro)', () => {
    const base = slugifyBinderName('csv-import-2026-08-26');
    expect(base).toBe('csv-import-2026-08-2'); // proves the base hits the cap
    const slug = generateUniqueBinderSlug('csv-import-2026-08-26', [base]);
    expect(slug).not.toBe(base);
    expect(slug.length).toBeLessThanOrEqual(MAX);
    expect(slug).toMatch(/^[a-z0-9_-]+$/);
  });

  it('yields a distinct slug on every repeated same-day import', () => {
    const existing: string[] = [];
    for (let n = 0; n < 50; n++) {
      const slug = generateUniqueBinderSlug('csv-import-2026-08-26', existing);
      expect(existing).not.toContain(slug);
      expect(slug.length).toBeLessThanOrEqual(MAX);
      existing.push(slug);
    }
    expect(new Set(existing).size).toBe(50);
  });

  it('still terminates when thousands of numbered candidates are taken', () => {
    const existing: string[] = [];
    for (let n = 0; n < 1200; n++) {
      const slug = generateUniqueBinderSlug('csv-import-2026-08-26', existing);
      expect(existing).not.toContain(slug);
      expect(slug.length).toBeLessThanOrEqual(MAX);
      existing.push(slug);
    }
    expect(new Set(existing).size).toBe(1200);
  });
});
