// Unit tests for the Pimp My Deck engine — ranks printing "bling" and picks
// the unowned upgrades for each deck card.
import { describe, expect, test } from 'vitest';
import { pimpScore, pimpBadges, computePimpUpgrades, type PimpPrinting } from './pimp-upgrades';

function printing(over: Partial<PimpPrinting> & { printing_id: string }): PimpPrinting {
  return {
    card_unique_id: 'card-1',
    name: 'Shelter from the Storm',
    set: 'evo',
    collector_number: 'EVO123',
    edition: 'N',
    foiling: 'S',
    rarity: 'R',
    is_extended_art: false,
    art_variations: [],
    image_url: 'https://img/x',
    tcg_low: 1.5,
    tcgplayer_url: 'https://tcg/x',
    ...over,
  };
}

describe('pimpScore', () => {
  test('non-foil base printing scores zero', () => {
    expect(pimpScore(printing({ printing_id: 'p1' }))).toBe(0);
  });

  test('bling ladder: non-foil < rainbow < cold < gold foil', () => {
    const nf = pimpScore(printing({ printing_id: 'p1', foiling: 'S' }));
    const rf = pimpScore(printing({ printing_id: 'p2', foiling: 'R' }));
    const cf = pimpScore(printing({ printing_id: 'p3', foiling: 'C' }));
    const gf = pimpScore(printing({ printing_id: 'p4', foiling: 'G' }));
    expect(nf).toBeLessThan(rf);
    expect(rf).toBeLessThan(cf);
    expect(cf).toBeLessThan(gf);
  });

  test('marvel rarity outranks any plain foil of the same card', () => {
    const gf = pimpScore(printing({ printing_id: 'p1', foiling: 'G' }));
    const marvel = pimpScore(printing({ printing_id: 'p2', foiling: 'C', rarity: 'V' }));
    expect(marvel).toBeGreaterThan(gf);
  });

  test('extended art beats the same foiling without it; alt-art variations count too', () => {
    const rf = pimpScore(printing({ printing_id: 'p1', foiling: 'R' }));
    const eaRf = pimpScore(printing({ printing_id: 'p2', foiling: 'R', is_extended_art: true }));
    const aaRf = pimpScore(printing({ printing_id: 'p3', foiling: 'R', art_variations: ['AA'] }));
    expect(eaRf).toBeGreaterThan(rf);
    expect(aaRf).toBeGreaterThan(rf);
  });

  test('EA flag and EA in art_variations do not double-count', () => {
    const flagged = pimpScore(printing({ printing_id: 'p1', is_extended_art: true }));
    const both = pimpScore(printing({ printing_id: 'p2', is_extended_art: true, art_variations: ['EA'] }));
    expect(both).toBe(flagged);
  });

  test('alpha and first editions add bling over unlimited/normal', () => {
    const normal = pimpScore(printing({ printing_id: 'p1', edition: 'N' }));
    const first = pimpScore(printing({ printing_id: 'p2', edition: 'F' }));
    const alpha = pimpScore(printing({ printing_id: 'p3', edition: 'A' }));
    expect(first).toBeGreaterThan(normal);
    expect(alpha).toBeGreaterThan(first);
  });
});

describe('pimpBadges', () => {
  test('labels the bling that makes the printing special', () => {
    expect(pimpBadges(printing({
      printing_id: 'p1', foiling: 'C', rarity: 'V', is_extended_art: true, edition: 'A',
    }))).toEqual(['Marvel', 'Cold Foil', 'Extended Art', 'Alpha']);
  });

  test('plain printing gets no badges', () => {
    expect(pimpBadges(printing({ printing_id: 'p1' }))).toEqual([]);
  });
});

describe('computePimpUpgrades', () => {
  const base = printing({ printing_id: 'nf', foiling: 'S' });
  const rf = printing({ printing_id: 'rf', foiling: 'R', tcg_low: 4 });
  const eaRf = printing({ printing_id: 'ea-rf', foiling: 'R', is_extended_art: true, tcg_low: 25 });
  const cf = printing({ printing_id: 'cf', foiling: 'C', tcg_low: 90 });
  const marvel = printing({ printing_id: 'marvel', foiling: 'C', rarity: 'V', tcg_low: 400 });

  const deckCards = [{ cardUniqueId: 'card-1', name: 'Shelter from the Storm', quantity: 3 }];
  const printings = [base, rf, eaRf, cf, marvel];

  test('their example: owning EA-RF + non-foils surfaces only strictly blingier unowned printings', () => {
    const result = computePimpUpgrades(deckCards, printings, { 'ea-rf': 1, nf: 2 });
    expect(result.cards).toHaveLength(1);
    const card = result.cards[0];
    // Plain RF is below the owned EA-RF; base is owned; CF and Marvel remain.
    expect(card.upgrades.map((u) => u.printingId)).toEqual(['marvel', 'cf']);
    expect(card.bestOwned?.printingId).toBe('ea-rf');
    // The wire shape's proper-cased `name` feeds the DTO's displayName.
    expect(card.upgrades[0].displayName).toBe('Shelter from the Storm');
    expect(card.quantity).toBe(3);
  });

  test('owning nothing → every special printing is an upgrade, plain base is not', () => {
    const result = computePimpUpgrades(deckCards, printings, {});
    expect(result.cards[0].upgrades.map((u) => u.printingId)).toEqual(['marvel', 'cf', 'ea-rf', 'rf']);
    expect(result.cards[0].bestOwned).toBeNull();
  });

  test('fully pimped card (owning the top printing) drops out of the list', () => {
    const result = computePimpUpgrades(deckCards, printings, { marvel: 1 });
    expect(result.cards).toHaveLength(0);
    expect(result.fullyPimped).toBe(1);
  });

  test('upgrades sort by bling then price; equal-bling variants both appear', () => {
    const aaCf = printing({ printing_id: 'aa-cf', foiling: 'C', art_variations: ['AA'], tcg_low: 60 });
    const eaCf = printing({ printing_id: 'ea-cf', foiling: 'C', is_extended_art: true, tcg_low: 80 });
    const result = computePimpUpgrades(deckCards, [base, aaCf, eaCf], { nf: 1 });
    // Same score → cheaper first.
    expect(result.cards[0].upgrades.map((u) => u.printingId)).toEqual(['aa-cf', 'ea-cf']);
  });

  test('totals the top pick per card into the full-pimp cost', () => {
    const other = printing({ printing_id: 'o-cf', card_unique_id: 'card-2', name: 'Command and Conquer', foiling: 'C', tcg_low: 100 });
    const otherBase = printing({ printing_id: 'o-nf', card_unique_id: 'card-2', name: 'Command and Conquer', foiling: 'S' });
    const result = computePimpUpgrades(
      [...deckCards, { cardUniqueId: 'card-2', name: 'Command and Conquer', quantity: 2 }],
      [...printings, other, otherBase],
      {},
    );
    // marvel (400) tops card-1, o-cf (100) tops card-2.
    expect(result.topPickTotal).toBe(500);
  });

  test('cards with no printings rows or no upgrades are skipped quietly', () => {
    const result = computePimpUpgrades(
      [...deckCards, { cardUniqueId: 'card-missing', name: 'Mystery', quantity: 1 }],
      printings,
      { marvel: 1 },
    );
    expect(result.cards).toHaveLength(0);
  });
});
