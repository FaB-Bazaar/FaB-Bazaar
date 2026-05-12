import { describe, expect, test } from 'vitest';
import { computeBuildProgress } from './build-progress';
import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService';

const printing = (types: string[], quantity = 1): DeckPrintingDTO => ({
  printingId: `p-${Math.random()}`,
  quantity,
  printingDetails: { types },
});

const emptyDeck = (overrides: Partial<DeckDTO> = {}): DeckDTO => ({
  _id: 'd1',
  publicId: 'd1',
  userId: 'u1',
  name: 'Test',
  format: 'classic constructed' as any,
  visibility: 'private' as any,
  isPublic: false,
  hero: [],
  equipment: [],
  maindeck: [],
  inventory: [],
  ...overrides,
});

describe('computeBuildProgress', () => {
  test('empty deck returns zero counts and overallComplete=false', () => {
    const result = computeBuildProgress(emptyDeck(), 'classic constructed');

    expect(result.steps.gear.current).toBe(0);
    expect(result.steps.attacks.current).toBe(0);
    expect(result.steps.defense.current).toBe(0);
    expect(result.steps.utility.current).toBe(0);
    expect(result.totalCards.current).toBe(0);
    expect(result.overallComplete).toBe(false);
  });

  test('CC targets are populated from format table', () => {
    const result = computeBuildProgress(emptyDeck(), 'classic constructed');

    expect(result.steps.gear.target).toBe(4);
    expect(result.steps.attacks.target).toBe(24);
    expect(result.steps.defense.target).toBe(15);
    expect(result.steps.utility.target).toBe(12);
    expect(result.totalCards.target).toBe(80);
  });

  test('Silver Age maindeck target is 55', () => {
    const result = computeBuildProgress(emptyDeck(), 'silver age');

    expect(result.totalCards.target).toBe(55);
    expect(result.steps.attacks.target).toBe(16);
    expect(result.steps.defense.target).toBe(10);
    expect(result.steps.utility.target).toBe(8);
  });

  test('Blitz maindeck target is 52', () => {
    const result = computeBuildProgress(emptyDeck(), 'blitz');
    expect(result.totalCards.target).toBe(52);
  });

  test('Commoner maindeck target is 55', () => {
    const result = computeBuildProgress(emptyDeck(), 'commoner');
    expect(result.totalCards.target).toBe(55);
  });

  test('counts equipment and weapons as gear', () => {
    const deck = emptyDeck({
      equipment: [
        printing(['equipment']),
        printing(['weapon']),
        printing(['equipment']),
      ],
    });
    const result = computeBuildProgress(deck, 'classic constructed');

    expect(result.steps.gear.current).toBe(3);
  });

  test('counts attack actions as attacks (using quantity)', () => {
    const deck = emptyDeck({
      maindeck: [
        printing(['action', 'attack'], 3),
        printing(['action', 'attack'], 3),
      ],
    });
    const result = computeBuildProgress(deck, 'classic constructed');

    expect(result.steps.attacks.current).toBe(6);
  });

  test('counts defense reactions as defense', () => {
    const deck = emptyDeck({
      maindeck: [printing(['defense reaction'], 3)],
    });
    const result = computeBuildProgress(deck, 'classic constructed');

    expect(result.steps.defense.current).toBe(3);
  });

  test('counts non-attack actions as defense (v1 simplification)', () => {
    const deck = emptyDeck({
      maindeck: [printing(['action'], 2)],
    });
    const result = computeBuildProgress(deck, 'classic constructed');

    expect(result.steps.defense.current).toBe(2);
  });

  test('counts instants, items, allies, attack reactions as utility', () => {
    const deck = emptyDeck({
      maindeck: [
        printing(['instant'], 2),
        printing(['item'], 1),
        printing(['ally'], 1),
        printing(['attack reaction'], 3),
      ],
    });
    const result = computeBuildProgress(deck, 'classic constructed');

    expect(result.steps.utility.current).toBe(7);
  });

  test('hero cards are excluded from all step counts', () => {
    const deck = emptyDeck({
      hero: [printing(['hero'])],
    });
    const result = computeBuildProgress(deck, 'classic constructed');

    expect(result.steps.gear.current).toBe(0);
    expect(result.steps.attacks.current).toBe(0);
    expect(result.steps.defense.current).toBe(0);
    expect(result.steps.utility.current).toBe(0);
  });

  test('missing quantity defaults to 1', () => {
    const deck = emptyDeck({
      maindeck: [{ printingId: 'p1', printingDetails: { types: ['action', 'attack'] } }],
    });
    const result = computeBuildProgress(deck, 'classic constructed');

    expect(result.steps.attacks.current).toBe(1);
  });

  test('step.complete is true when current >= 80% of target', () => {
    const deck = emptyDeck({
      equipment: [printing(['equipment']), printing(['equipment']), printing(['equipment']), printing(['weapon'])], // 4/4 = 100%
      maindeck: [
        printing(['action', 'attack'], 20), // 20/24 = 83% → complete
        printing(['defense reaction'], 11), // 11/15 = 73% → not complete
      ],
    });
    const result = computeBuildProgress(deck, 'classic constructed');

    expect(result.steps.gear.complete).toBe(true);
    expect(result.steps.attacks.complete).toBe(true);
    expect(result.steps.defense.complete).toBe(false);
  });

  test('overallComplete is true only when all 4 steps are complete', () => {
    // All steps at target
    const fullDeck = emptyDeck({
      equipment: [printing(['equipment']), printing(['equipment']), printing(['equipment']), printing(['weapon'])],
      maindeck: [
        printing(['action', 'attack'], 24),
        printing(['defense reaction'], 15),
        printing(['instant'], 12),
      ],
    });
    expect(computeBuildProgress(fullDeck, 'classic constructed').overallComplete).toBe(true);

    // One step missing
    const incomplete = emptyDeck({
      equipment: [printing(['equipment']), printing(['equipment']), printing(['equipment']), printing(['weapon'])],
      maindeck: [
        printing(['action', 'attack'], 24),
        printing(['defense reaction'], 15),
        // utility missing
      ],
    });
    expect(computeBuildProgress(incomplete, 'classic constructed').overallComplete).toBe(false);
  });

  test('totalCards counts maindeck only (not equipment, not inventory)', () => {
    const deck = emptyDeck({
      equipment: [printing(['equipment']), printing(['weapon'])], // 2 — excluded
      maindeck: [printing(['action', 'attack'], 60)],              // 60 — counted
      inventory: [printing(['action', 'attack'], 5)],              // 5 — excluded
    });
    const result = computeBuildProgress(deck, 'classic constructed');

    expect(result.totalCards.current).toBe(60);
  });

  test('unknown format falls back to CC targets and does not throw', () => {
    const deck = emptyDeck({ format: 'open' as any });
    const result = computeBuildProgress(deck, 'open');

    // Falls back to CC for now — slice 1 only supports CC
    expect(result.steps.attacks.target).toBe(24);
  });
});
