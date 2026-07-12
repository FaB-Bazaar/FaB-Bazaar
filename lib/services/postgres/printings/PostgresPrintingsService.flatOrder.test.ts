/**
 * Integration tests: FLAT search orders same-card printings canonically.
 *
 * The primary sort finds the right CARDS (name relevance / user choice); the
 * canonical cascade then orders each card's PRINTINGS as a trailing tiebreak:
 * English → gold foils last → Marvels last globally → curated
 * sets.display_order → edition (unlimited-first where flagged) → foiling →
 * price.
 *
 * This is what /search/results (home page search) renders verbatim — it does
 * no client-side re-sort. Runs against local Postgres.
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

describe('PostgresPrintingsService — flat search canonical printing order', () => {
  it('orders Crown of Dominion printings canonically under the default name sort', async () => {
    const res = await service.searchPrintings(
      { name: 'crown of dominion' },
      { limit: 50, searchMode: 'strict', sortBy: 'name', sortOrder: 'asc' },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    const rows = res.data.printings.map((p) => `${p.set}/${p.edition}/${p.foiling}/${p.rarity}`);
    expect(rows).toEqual([
      'dyn/n/r/l', // canonical: Dynasty rainbow (no NF run exists)
      'dyn/n/c/l', // then cold foil
      'gem/n/r/p', // GEM promo by set order
      'dyn/n/c/v', // Marvel sinks below every non-Marvel, even cross-set
      'fab/n/g/p', // gold foil dead last despite earlier set order
    ]);
  });

  it('puts English printings before localized ones within the same card', async () => {
    const res = await service.searchPrintings(
      { name: 'command and conquer' },
      { limit: 100, searchMode: 'strict', sortBy: 'name', sortOrder: 'asc' },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    const langs = res.data.printings.map((p) => (p.language === 'en' ? 'en' : 'xx'));
    // All English rows form one contiguous block before any non-English row
    expect(langs.join(',')).not.toMatch(/xx,en/);
    // And the first row is the canonical original: ARC Unlimited non-foil
    const first = res.data.printings[0];
    expect(`${first.set}/${first.edition}/${first.foiling}/${first.language}`).toBe('arc/u/s/en');
  });

  it('groups localized printings language-major (en → fr → ja → others alphabetical), like the client cascade', async () => {
    // Machinations of Dominion has en/fr/ja/de/es/it printings in both NF and
    // RF — language must outrank foiling so each language's printings stay
    // together instead of interleaving by foil treatment.
    const res = await service.searchPrintings(
      { name: 'machinations of dominion' },
      { limit: 100, searchMode: 'strict', sortBy: 'name', sortOrder: 'asc' },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    const langSequence = res.data.printings.map((p) => p.language);
    const blocks = langSequence.filter((l, i) => i === 0 || langSequence[i - 1] !== l);
    expect(blocks).toEqual(['en', 'fr', 'ja', 'de', 'es', 'it']);
  });
});
