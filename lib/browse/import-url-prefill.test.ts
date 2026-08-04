// lib/browse/import-url-prefill.test.ts
//
// /browse?cards=…&binder=… prefill: parse the link, subtract card-level
// ownership (any printing variant counts), and synthesize the card-list text
// that seeds the existing bulk-import pipeline.

import { describe, test, expect } from 'vitest';
import {
  parseBrowsePrefillParams,
  computePrefillPlan,
  toCardListText,
  isPrefillReady,
} from './import-url-prefill';
import { parseBulkInput } from '@/lib/browse/parsers/bulk-input-parser';

const LOOKUP = {
  kiss_of_death_red: { displayName: 'Kiss of Death', pitch: 1, cardUniqueId: 'card-kod' },
  hunters_klaive: { displayName: "Hunter's Klaive", pitch: null, cardUniqueId: 'card-hk' },
  codex_of_frailty_yellow: { displayName: 'Codex of Frailty', pitch: 2, cardUniqueId: 'card-cof' },
};

describe('parseBrowsePrefillParams', () => {
  test('reads repeat-per-copy cards and the binder slug', () => {
    const p = parseBrowsePrefillParams(new URLSearchParams(
      'cards=kiss_of_death_red,kiss_of_death_red,hunters-klaive&binder=my-trades',
    ));
    expect(p.binderSlug).toBe('my-trades');
    expect(p.cards).toEqual([
      { slug: 'kiss_of_death_red', talisharId: 'kiss_of_death_red', quantity: 2 },
      { slug: 'hunters-klaive', talisharId: 'hunters_klaive', quantity: 1 },
    ]);
  });

  test('defaults to empty cards and no binder when params are absent', () => {
    const p = parseBrowsePrefillParams(new URLSearchParams());
    expect(p.cards).toEqual([]);
    expect(p.binderSlug).toBe('');
  });
});

describe('computePrefillPlan', () => {
  const cards = (spec: Array<[string, number]>) =>
    spec.map(([talisharId, quantity]) => ({ slug: talisharId, talisharId, quantity }));

  test('subtracts card-level owned copies from the requested quantity', () => {
    const plan = computePrefillPlan(cards([['kiss_of_death_red', 3]]), LOOKUP, { 'card-kod': 1 });
    expect(plan.lines).toEqual([{ displayName: 'Kiss of Death', pitch: 1, quantity: 2 }]);
    expect(plan.summary).toEqual({ requested: 3, owned: 1, toAdd: 2 });
  });

  test('a fully-owned card produces no line and lands in skipped', () => {
    const plan = computePrefillPlan(cards([['hunters_klaive', 1]]), LOOKUP, { 'card-hk': 4 });
    expect(plan.lines).toEqual([]);
    expect(plan.skipped).toEqual([{ displayName: "Hunter's Klaive", requested: 1, owned: 4 }]);
    expect(plan.summary).toEqual({ requested: 1, owned: 1, toAdd: 0 });
  });

  test('unowned cards pass through at full quantity', () => {
    const plan = computePrefillPlan(cards([['codex_of_frailty_yellow', 2]]), LOOKUP, {});
    expect(plan.lines).toEqual([{ displayName: 'Codex of Frailty', pitch: 2, quantity: 2 }]);
    expect(plan.skipped).toEqual([]);
    expect(plan.summary).toEqual({ requested: 2, owned: 0, toAdd: 2 });
  });

  test('tokens missing from the lookup are reported unresolved and not counted', () => {
    const plan = computePrefillPlan(
      cards([['no_such_card_red', 2], ['kiss_of_death_red', 1]]),
      LOOKUP,
      {},
    );
    expect(plan.unresolved).toEqual(['no_such_card_red']);
    expect(plan.summary).toEqual({ requested: 1, owned: 0, toAdd: 1 });
  });
});

describe('isPrefillReady', () => {
  // Regression: AuthContext derives `user` in an effect AFTER the session
  // resolves, so there's a render where status is 'authenticated' but user is
  // still null. Running the prefill there skips ownership netting silently.
  test('waits while the session is authenticated but the user object has not landed', () => {
    expect(isPrefillReady({ cardCount: 2, sessionStatus: 'authenticated', hasUser: false })).toBe(false);
  });

  test('runs once the authenticated user object is present', () => {
    expect(isPrefillReady({ cardCount: 2, sessionStatus: 'authenticated', hasUser: true })).toBe(true);
  });

  test('runs signed-out when the session is genuinely unauthenticated', () => {
    expect(isPrefillReady({ cardCount: 2, sessionStatus: 'unauthenticated', hasUser: false })).toBe(true);
  });

  test('never runs while the session is loading or with no cards', () => {
    expect(isPrefillReady({ cardCount: 2, sessionStatus: 'loading', hasUser: false })).toBe(false);
    expect(isPrefillReady({ cardCount: 0, sessionStatus: 'unauthenticated', hasUser: false })).toBe(false);
  });
});

describe('toCardListText', () => {
  test('round-trips through the cardlist parser with quantities and pitch colors', () => {
    const text = toCardListText([
      { displayName: 'Kiss of Death', pitch: 1, quantity: 2 },
      { displayName: "Hunter's Klaive", pitch: null, quantity: 1 },
      { displayName: 'Codex of Frailty', pitch: 2, quantity: 3 },
    ]);
    const parsed = parseBulkInput(text, 'cardlist');
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ name: 'kiss of death', quantity: 2, color: 'red' });
    expect(parsed[1]).toMatchObject({ name: "hunter's klaive", quantity: 1, color: '' });
    expect(parsed[2]).toMatchObject({ name: 'codex of frailty', quantity: 3, color: 'yellow' });
  });
});
