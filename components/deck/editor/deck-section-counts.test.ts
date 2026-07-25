/**
 * computeDeckSectionCounts — zone counts for the deck-page stat chips.
 *
 * Must mirror the tiles-view classification (classifyTileCard): weapons and
 * equipment split out of the shared "Equipment & Weapons" section, maindeck =
 * the pitch lanes, hero excluded. Uses card TYPES, not just stored category,
 * so equipment-typed cards chord-added under maindeck still count as equipment
 * (the "Card category ≠ card type" gotcha).
 */
import { describe, it, expect } from 'vitest';
import { computeDeckSectionCounts } from './deck-section-counts';

const card = (
  printingId: string,
  types: string[],
  quantity = 1,
  pitch: number | null = null,
) => ({
  printingId,
  quantity,
  printingDetails: { types, pitch },
}) as any;

const deck = (parts: Partial<Record<'hero' | 'maindeck' | 'equipment' | 'inventory' | 'benched', any[]>>) =>
  ({ hero: [], maindeck: [], equipment: [], inventory: [], benched: [], ...parts }) as any;

describe('computeDeckSectionCounts', () => {
  it('splits weapons from other equipment', () => {
    const counts = computeDeckSectionCounts(deck({
      equipment: [
        card('w1', ['weapon'], 2),
        card('e1', ['equipment'], 1),
        card('e2', ['equipment'], 3),
      ],
    }));
    expect(counts.weapon).toBe(2);
    expect(counts.equipment).toBe(4);
  });

  it('counts maindeck as the pitch lanes with quantities', () => {
    const counts = computeDeckSectionCounts(deck({
      maindeck: [
        card('r', ['action'], 3, 1),
        card('y', ['action'], 2, 2),
        card('b', ['action'], 3, 3),
        card('n', ['action'], 1, null),
      ],
    }));
    expect(counts.maindeck).toBe(9);
  });

  it('classifies equipment-typed cards stored under maindeck as equipment (category ≠ type gotcha)', () => {
    const counts = computeDeckSectionCounts(deck({
      maindeck: [
        card('e', ['equipment'], 1),
        card('a', ['action'], 4, 1),
      ],
    }));
    expect(counts.equipment).toBe(1);
    expect(counts.maindeck).toBe(4);
  });

  it('counts inventory and bench by their stored category', () => {
    const counts = computeDeckSectionCounts(deck({
      inventory: [card('i', ['action'], 5, 1)],
      benched: [card('bn', ['action'], 2, 3)],
    }));
    expect(counts.inventory).toBe(5);
    expect(counts.bench).toBe(2);
  });

  it('excludes hero cards entirely', () => {
    const counts = computeDeckSectionCounts(deck({
      hero: [card('h', ['hero'], 1)],
      maindeck: [card('h2', ['hero'], 1)],
    }));
    expect(counts.maindeck).toBe(0);
    expect(counts.equipment).toBe(0);
    expect(counts.weapon).toBe(0);
  });

  it('evo cards with equipment type stay in maindeck unless weapons', () => {
    const counts = computeDeckSectionCounts(deck({
      maindeck: [
        card('evo', ['evo', 'equipment'], 1, 2),
        card('evoW', ['evo', 'weapon'], 1),
      ],
    }));
    expect(counts.maindeck).toBe(1);
    expect(counts.weapon).toBe(1);
    expect(counts.equipment).toBe(0);
  });

  it('handles missing arrays and missing quantity (defaults to 1)', () => {
    const counts = computeDeckSectionCounts({
      maindeck: [{ printingId: 'x', printingDetails: { types: ['action'], pitch: 1 } }],
    } as any);
    expect(counts.maindeck).toBe(1);
    expect(counts.inventory).toBe(0);
    expect(counts.bench).toBe(0);
  });
});
