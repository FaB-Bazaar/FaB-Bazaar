/**
 * Integration tests for opt-in card-level grouping in searchPrintings
 * (options.groupByCard). Runs against local Postgres.
 *
 * The first test is a REGRESSION GUARD: the default (no groupByCard) path must
 * keep returning every printing of a card — the card-search dialog and other
 * collection-adding dialogs depend on that for their printing-selection step.
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

const CC = { name: 'command and conquer', languages: ['en'] };

describe('PostgresPrintingsService — grouped search (opt-in)', () => {
  it('FLAT default returns multiple printings per card (dialog dependency)', async () => {
    const res = await service.searchPrintings(CC, { limit: 100, searchMode: 'strict' });
    expect(res.success).toBe(true);
    if (!res.success) return;

    const ids = res.data.printings.map((p) => p.card_unique_id);
    // Command and Conquer has many English printings; the same card_unique_id
    // must appear more than once so the dialog can list every printing.
    expect(ids.length).toBeGreaterThan(new Set(ids).size);
  });

  it('GROUPED returns exactly one row per card_unique_id', async () => {
    const res = await service.searchPrintings(CC, { limit: 100, searchMode: 'strict', groupByCard: true });
    expect(res.success).toBe(true);
    if (!res.success) return;

    const ids = res.data.printings.map((p) => p.card_unique_id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length); // no duplicate cards
  });

  it('GROUPED represents each card by its canonical printing (curated set order, not price)', async () => {
    // Fyendal's Spring Tunic: original printing is WTR150 (display_order 10);
    // the CHEAPEST printing is the 1HP reprint (display_order 200). The tile
    // must show the canonical WTR printing — unlimited before alpha per the
    // unlimited_before_first flag, rainbow foil because WTR had no non-foil
    // run of it — not the cheapest reprint.
    const [grouped, flat] = await Promise.all([
      service.searchPrintings({ name: "fyendal's spring tunic", languages: ['en'] }, { limit: 100, searchMode: 'strict', groupByCard: true }),
      service.searchPrintings({ name: "fyendal's spring tunic", languages: ['en'] }, { limit: 300, searchMode: 'strict' }),
    ]);
    expect(grouped.success && flat.success).toBe(true);
    if (!grouped.success || !flat.success) return;

    expect(grouped.data.printings.length).toBe(1);
    const repr = grouped.data.printings[0];

    // Sanity: the original wtr printing and the cheap 1hp reprint both exist
    const wtr = flat.data.printings.filter((p) => p.set === 'wtr');
    const hp = flat.data.printings.filter((p) => p.set === '1hp');
    expect(wtr.length).toBeGreaterThan(0);
    expect(hp.length).toBeGreaterThan(0);

    expect(repr.set).toBe('wtr');
    expect(repr.edition).toBe('u');
    expect(repr.foiling).toBe('r');
  });

  it('GROUPED representative is never a Marvel when a non-Marvel printing exists (any set)', async () => {
    // Oysten, Heart of Gold: the ONLY High Seas (sea) printing is the Marvel
    // (SEA263, rarity 'v'); the regular rare is in the Gravy Bones armory deck
    // (agb, later display_order). Set order must not shield the Marvel from
    // demotion — the accessible armory printing is the tile.
    const res = await service.searchPrintings(
      { name: 'oysten, heart of gold', languages: ['en'] },
      { limit: 10, searchMode: 'strict', groupByCard: true },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.printings.length).toBe(1);
    const repr = res.data.printings[0];
    expect(repr.rarity).not.toBe('v');
    expect(repr.set).toBe('agb');
  });

  it('GROUPED representative is an English printing when the card has one', async () => {
    // 'steel on steel' has ja/fr printings whose tcg_low is NULL alongside
    // English ones — without a language preference the printing_id tiebreak
    // can (and does) pick a non-English representative.
    const res = await service.searchPrintings(
      { name: 'steel on steel' },
      { limit: 50, searchMode: 'strict', groupByCard: true },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.printings.length).toBeGreaterThan(0);
    for (const p of res.data.printings) {
      expect(p.language).toBe('en');
    }
  });

  it('GROUPED representative carries printing_count = printings for that card', async () => {
    // Lets the dialog skip the per-card "expand" request for singleton cards:
    // each card-level row reports how many printings it stands for (same
    // filter/language scope), so the client knows whether a second fetch is
    // worthwhile.
    const [grouped, flat] = await Promise.all([
      service.searchPrintings(CC, { limit: 100, searchMode: 'strict', groupByCard: true }),
      service.searchPrintings(CC, { limit: 300, searchMode: 'strict' }),
    ]);
    expect(grouped.success && flat.success).toBe(true);
    if (!grouped.success || !flat.success) return;

    // True per-card printing counts from the flat path.
    const flatCounts = new Map<string, number>();
    for (const p of flat.data.printings) {
      flatCounts.set(p.card_unique_id, (flatCounts.get(p.card_unique_id) ?? 0) + 1);
    }

    expect(grouped.data.printings.length).toBeGreaterThan(0);
    for (const repr of grouped.data.printings) {
      expect(repr.printing_count).toBe(flatCounts.get(repr.card_unique_id));
    }
    // Sanity: Command and Conquer has cards with multiple printings, so we're
    // actually exercising counts > 1 (not just trivially-1 singletons).
    expect(Math.max(...grouped.data.printings.map((r) => r.printing_count ?? 0))).toBeGreaterThan(1);
  });

  it('GROUPED total counts distinct cards, not printings', async () => {
    const grouped = await service.searchPrintings(
      { classes: ['ninja'], rarities: ['c'], languages: ['en'] },
      { limit: 5, groupByCard: true },
    );
    const flat = await service.searchPrintings(
      { classes: ['ninja'], rarities: ['c'], languages: ['en'] },
      { limit: 5 },
    );
    expect(grouped.success && flat.success).toBe(true);
    if (!grouped.success || !flat.success) return;

    expect(grouped.data.total).toBeGreaterThan(0);
    // Far fewer distinct cards than total printings.
    expect(grouped.data.total).toBeLessThan(flat.data.total);
    expect(grouped.data.printings.length).toBeLessThanOrEqual(5);
  });
});
