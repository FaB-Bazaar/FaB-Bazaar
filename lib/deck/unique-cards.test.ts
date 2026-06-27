import { describe, it, expect } from 'vitest';
import { collectUniqueCards, cardKey } from './unique-cards';

const card = (name: string, pitch = 0) => ({ printingDetails: { display_name: name, pitch } });

describe('collectUniqueCards', () => {
  it('dedupes by name+pitch across maindeck/equipment/hero/inventory (one entry per unique card)', () => {
    const deck = {
      hero: [card('Teklovossen, Esteemed Magnate')],
      equipment: [card('Teklo Leveler')],
      maindeck: [card('Command and Conquer', 1), card('Command and Conquer', 1), card('Sink Below', 1)],
      inventory: [card('Midas Touch', 2)], // sideboard pool
    } as any;
    const out = collectUniqueCards(deck);
    const keys = out.map((c) => c.key);
    expect(keys).toContain(cardKey('Command and Conquer', 1));
    expect(keys.filter((k) => k === cardKey('Command and Conquer', 1))).toHaveLength(1); // 2 copies -> 1
    expect(keys).toContain(cardKey('Midas Touch', 2)); // inventory/sideboard included
  });

  it('keeps same-name different-pitch as distinct cards', () => {
    const deck = { maindeck: [card('Blade Runner', 1), card('Blade Runner', 3)] } as any;
    expect(collectUniqueCards(deck)).toHaveLength(2);
  });

  it('sorts by name then pitch and tolerates a missing/empty deck', () => {
    expect(collectUniqueCards(null)).toEqual([]);
    const deck = { maindeck: [card('Zephyr', 0), card('Apex', 0)] } as any;
    expect(collectUniqueCards(deck).map((c) => c.name)).toEqual(['Apex', 'Zephyr']);
  });
});
