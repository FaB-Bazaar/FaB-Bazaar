// lib/fab-constants/sets.test.ts
//
// Pins the ordering contract of sortPrintings: physical-printing language is
// the PRIMARY key (English first), and the pre-existing set-tier ordering
// (main booster sets before armory-deck reprints) holds within each language.

import { describe, it, expect } from 'vitest';
import { getOrderedSets, sortPrintings, SET_METADATA } from './sets';

describe('getOrderedSets — set categorization', () => {
  it('lists MPW (Mastery Pack Warrior) as a standard set, and only there', () => {
    const { standard, nonStandard } = getOrderedSets();

    expect(standard.map((s) => s.code.toLowerCase())).toContain('mpw');
    expect(nonStandard.map((s) => s.code.toLowerCase())).not.toContain('mpw');
  });
});

describe('sortPrintings — language priority', () => {
  it('puts English printings before non-English ones regardless of set order', () => {
    // wtr (2019, tier 1) would beat evo (2023, tier 1) on release date — but
    // the wtr copy is French, so the English evo printing must come first.
    const fr = { set: 'wtr', foiling: 's', edition: 'u', language: 'fr' };
    const en = { set: 'evo', foiling: 's', edition: 'n', language: 'en' };

    const sorted = sortPrintings([fr, en]);

    expect(sorted[0].language).toBe('en');
    expect(sorted[1].language).toBe('fr');
  });

  it('keeps main sets before armory-deck reprints within the same language', () => {
    // Same release date (2019-10-11): wtr is a tier-1 main booster set, asr is
    // a tier-4 armory deck. English main set first, then the English armory
    // reprint, then any non-English printing.
    const enArmory = { set: 'asr', foiling: 's', edition: 'n', language: 'en' };
    const enMain = { set: 'wtr', foiling: 's', edition: 'u', language: 'en' };
    const frMain = { set: 'wtr', foiling: 's', edition: 'u', language: 'fr' };

    const sorted = sortPrintings([frMain, enArmory, enMain]);

    expect(sorted.map((p) => `${p.language}:${p.set}`)).toEqual([
      'en:wtr',
      'en:asr',
      'fr:wtr',
    ]);
  });

  it('treats a missing language as English', () => {
    const noLang = { set: 'wtr', foiling: 's', edition: 'u' };
    const ja = { set: 'wtr', foiling: 's', edition: 'u', language: 'ja' };

    const sorted = sortPrintings([ja, noLang]);

    expect(sorted[0]).toBe(noLang);
  });

  it('orders same-language printings by the curated displayOrder from the sets table', () => {
    // Three sets whose seeded displayOrder encodes main → supplemental → armory.
    // The sort must follow SET_METADATA[code].displayOrder — the number curated
    // on the DB row — not re-derive from tier/date itself.
    const printings = [
      { set: 'asr', foiling: 's', edition: 'n', language: 'en' }, // armory
      { set: 'wtr', foiling: 's', edition: 'u', language: 'en' }, // main
      { set: '1hp', foiling: 's', edition: 'n', language: 'en' }, // supplemental
    ];

    const sorted = sortPrintings(printings);

    const orders = sorted.map((p) => (SET_METADATA[p.set] as any).displayOrder);
    expect(orders.every((o: any) => typeof o === 'number')).toBe(true);
    expect([...orders].sort((a: number, b: number) => a - b)).toEqual(orders);
    expect(sorted.map((p) => p.set)).toEqual(['wtr', '1hp', 'asr']);
  });

  it('orders within a set edition-major: Unl NF → Unl RF → 1st NF → 1st CF → Marvel (WTR rules)', () => {
    // wtr is an unlimited-before-first set. Edition outranks foiling: all
    // unlimited printings come before any first-edition printing.
    const unlRF = { set: 'wtr', foiling: 'r', edition: 'u', language: 'en' };
    const firstNF = { set: 'wtr', foiling: 's', edition: 'f', language: 'en' };
    const unlNF = { set: 'wtr', foiling: 's', edition: 'u', language: 'en' };
    const firstCF = { set: 'wtr', foiling: 'c', edition: 'f', language: 'en' };
    const marvel = { set: 'wtr', foiling: 'c', edition: 'u', rarity: 'v', language: 'en' };

    const sorted = sortPrintings([marvel, firstCF, unlRF, firstNF, unlNF]);

    expect(sorted.map((p) => `${p.edition}${p.foiling}${(p as any).rarity ?? ''}`)).toEqual([
      'us', 'ur', 'fs', 'fc', 'ucv',
    ]);
  });

  it('reads unlimited-before-first from set metadata (ELE flipped via the sets table)', () => {
    // Tales of Aria had both editions; the DB row (not a hardcoded list) says
    // unlimited is the accessible printing. Pins that the flag flows from the
    // sets table through the generated snapshot.
    const first = { set: 'ele', foiling: 's', edition: 'f', language: 'en' };
    const unlimited = { set: 'ele', foiling: 's', edition: 'u', language: 'en' };

    const sorted = sortPrintings([first, unlimited]);

    expect(sorted.map((p) => p.edition)).toEqual(['u', 'f']);
  });

  it('sorts gold foils last regardless of set order (tournament-prize cards)', () => {
    // FAB promos (display_order 270) normally sort before GEM Pack (360), but
    // gold foils are tournament-winner prizes — effectively unacquirable — so
    // they always sink below every other printing.
    const goldPromo = { set: 'fab', foiling: 'g', edition: 'n', language: 'en' };
    const gemRainbow = { set: 'gem', foiling: 'r', edition: 'n', language: 'en' };
    const dynCold = { set: 'dyn', foiling: 'c', edition: 'n', language: 'en' };

    const sorted = sortPrintings([goldPromo, gemRainbow, dynCold]);

    expect(sorted.map((p) => p.set)).toEqual(['dyn', 'gem', 'fab']);
  });

  it('sinks Marvels below non-Marvel printings from ANY set, not just their own', () => {
    // Oysten, Heart of Gold: its only main-set (sea, display_order 160)
    // printing is the Marvel; the regular rare lives in the Gravy Bones armory
    // deck (agb, display_order 1030). Marvels are chase cards — the accessible
    // armory printing must be the default despite its later set order.
    const seaMarvel = { set: 'sea', foiling: 'c', edition: 'n', rarity: 'v', language: 'en' };
    const agbRare = { set: 'agb', foiling: 's', edition: 'n', rarity: 'r', language: 'en' };

    const sorted = sortPrintings([seaMarvel, agbRare]);

    expect(sorted.map((p) => p.set)).toEqual(['agb', 'sea']);
  });

  it('orders non-English groups deterministically (fr, ja, then others by code)', () => {
    const de = { set: 'wtr', foiling: 's', edition: 'u', language: 'de' };
    const ja = { set: 'wtr', foiling: 's', edition: 'u', language: 'ja' };
    const fr = { set: 'wtr', foiling: 's', edition: 'u', language: 'fr' };
    const es = { set: 'wtr', foiling: 's', edition: 'u', language: 'es' };

    const sorted = sortPrintings([de, ja, fr, es]);

    expect(sorted.map((p) => p.language)).toEqual(['fr', 'ja', 'de', 'es']);
  });
});
