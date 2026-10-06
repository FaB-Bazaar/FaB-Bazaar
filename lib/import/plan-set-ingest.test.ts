import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cardLookupKeys, planSetIngest, type ExistingCardRow, type ExistingPrintingRow, type SetIngestPlan } from './plan-set-ingest';

// Real CardVault payloads: two front heroes sharing one named back
// ("Viserai, Usurper"). The back's card shares the Forsaken's CardVault card
// UUID — the documented lss_card_id non-uniqueness.
const FIXTURES = join(__dirname, '__fixtures__', 'cardvault');
const SLUGS = ['viserai-the-forsaken--viserai-usurper', 'viserai-between-worlds--viserai-usurper'];
const payloads = new Map(SLUGS.map((s) => [s, JSON.parse(readFileSync(join(FIXTURES, `${s}.json`), 'utf8'))]));

let seq = 0;
const mintId = () => `id${++seq}`;

const plan = (over: { existingPrintings?: ExistingPrintingRow[]; cardRows?: ExistingCardRow[]; skipCollectors?: Set<string> } = {}) =>
  planSetIngest({
    set: 'IAR',
    setHasFirstEdition: false,
    familySlugs: SLUGS,
    payloads,
    existingPrintings: over.existingPrintings ?? [],
    cardRows: over.cardRows ?? [],
    skipCollectors: over.skipCollectors,
    mintId,
  });

/** The DB state a committed plan leaves behind, in the planner's input shape. */
function committed(p: SetIngestPlan): { existingPrintings: ExistingPrintingRow[]; cardRows: ExistingCardRow[] } {
  return {
    existingPrintings: p.newPrintings.map((r) => ({
      printing_id: r.printing_id,
      lss_print_id: r.lss_print_id,
      other_face_printing_id: r.other_face_printing_id ?? null,
      set: r.set,
      collector_number: r.collector_number,
      edition: r.edition,
      foiling: r.foiling,
      language: r.language,
    })),
    cardRows: p.newCards.map((c) => ({
      card_unique_id: c.card_unique_id,
      lss_card_id: c.lss_card_id ?? null,
      talishar_card_id: c.talishar_card_id,
      fab_cube_card_id: null,
    })),
  };
}

describe('planSetIngest', () => {
  it('plans a fresh set: each front, the shared named back once, and back-face rows', () => {
    const p = plan();
    expect(p.newCards.map((c) => c.talishar_card_id).sort()).toEqual(
      ['viserai_between_worlds', 'viserai_the_forsaken', 'viserai_usurper']);
    expect(p.newPrintings.length).toBeGreaterThan(0);
    expect(p.counts.backFaces).toBeGreaterThan(0);
    expect(p.newPrintings.every((r) => r.language === 'en' && r.set === 'iar')).toBe(true);
    const usurper = p.newCards.find((c) => c.talishar_card_id === 'viserai_usurper')!;
    const backs = p.newPrintings.filter((r) => r.is_front_face === false);
    expect(backs.every((r) => r.card_unique_id === usurper.card_unique_id)).toBe(true);
  });

  it('re-planning a committed set creates nothing', () => {
    const p = plan(committed(plan()));
    expect(p.newCards).toEqual([]);
    expect(p.newPrintings).toEqual([]);
    expect(p.retroLinks).toEqual([]);
  });

  // Regression: the named back's card shares the front's lss_card_id, and the
  // CLI resolved the front by lss_card_id with last-row-wins — enriching the
  // "Viserai, Usurper" card with the Forsaken's fields (a second "Viserai,
  // the Forsaken", Usurper gone) on any re-run.
  it('never enriches a named back card with its front face', () => {
    const state = committed(plan());
    const p = plan(state);
    const byId = new Map(state.cardRows.map((c) => [c.card_unique_id, c.talishar_card_id]));
    for (const e of p.enrichCards) {
      expect(e.talishar_card_id).toBe(byId.get(e.card_unique_id));
    }
  });

  it('skips collector numbers passed in skipCollectors', () => {
    const p = plan({ skipCollectors: new Set(['IAR106']) });
    expect(p.newPrintings.some((r) => r.collector_number === 'IAR106')).toBe(false);
    expect(p.counts.skippedFlag).toBeGreaterThan(0);
  });

  it('skips a print whose natural key already exists without an lss link', () => {
    const fresh = plan();
    const front = fresh.newPrintings.find((r) => r.is_front_face !== false && r.collector_number === 'IAR106')!;
    const p = plan({
      existingPrintings: [{
        printing_id: 'fabcube1', lss_print_id: null, other_face_printing_id: null, set: 'iar',
        collector_number: front.collector_number, edition: front.edition, foiling: front.foiling, language: 'en',
      }],
    });
    expect(p.counts.skippedNaturalKey).toBe(1);
    expect(p.newPrintings.length).toBe(fresh.newPrintings.length - 2); // the front and its back
  });
});

describe('cardLookupKeys', () => {
  it('returns the CardVault card ids and front talishar ids for the DB lookup', () => {
    const k = cardLookupKeys(SLUGS, payloads);
    expect(k.lssCardIds).toContain('bea60cd8-3383-429a-b4b2-a79d9bff140e');
    expect(k.talisharIds.sort()).toEqual(['viserai_between_worlds', 'viserai_the_forsaken']);
  });
});
