import { describe, it, expect } from 'vitest';
import { cardRegionFromBanner, rowsToStagedInstances, addStaged } from './review';

const p = (id: string, card = 'c1') => ({ printing_id: id, card_unique_id: card, display_name: 'Massacre' });

describe('cardRegionFromBanner', () => {
  it('estimates the whole card below an upright name banner (banner ~62% of card width, ~8.6% down)', () => {
    const r = cardRegionFromBanner({ cx: 100, cy: 50, w: 62, h: 6, angle: 0 });
    expect(r.w).toBeCloseTo(100, 0);
    expect(r.h).toBeCloseTo(139.7, 0);
    expect(r.cx).toBeCloseTo(100, 5);
    expect(r.cy).toBeCloseTo(50 + (0.5 - 0.086) * 139.7, 0);
    expect(r.angle).toBe(0);
  });

  it('puts the card on the "below the banner" side of a rotated banner', () => {
    const r = cardRegionFromBanner({ cx: 100, cy: 50, w: 62, h: 6, angle: 90 });   // banner reads top-to-bottom
    expect(r.cx).toBeLessThan(100);                                                  // card body to the left
    expect(r.cy).toBeCloseTo(50, 5);
  });
});

describe('rowsToStagedInstances', () => {
  it('turns checked cards into staged import rows, one per printing with its count', () => {
    const rows = [
      { id: 'a', printing: p('P1'), allPrintings: [p('P1'), p('P2')] },
      { id: 'b', printing: p('P1'), allPrintings: [p('P1'), p('P2')] },
      { id: 'c', printing: p('P2'), allPrintings: [p('P1'), p('P2')] },   // the user swapped this copy's printing
    ];
    const out = rowsToStagedInstances(rows);
    expect(out).toHaveLength(2);
    expect(out.find(i => i.selectedPrinting.printing_id === 'P1')).toMatchObject({ quantity: 2, isStaged: true, card_unique_id: 'c1', forTrade: false });
    expect(out.find(i => i.selectedPrinting.printing_id === 'P2')?.quantity).toBe(1);
    expect(new Set(out.map(i => i.instanceId)).size).toBe(2);
  });
});

describe('addStaged', () => {
  const inst = (id: string, printing: string, quantity: number, isStaged: boolean) =>
    ({ instanceId: id, mergeKey: `c1|`, card_unique_id: 'c1', selectedPrinting: p(printing), quantity, forTrade: false, allPrintings: [], isStaged });

  it('folds into an already-staged row of the same printing (quantities add), like staging on /browse', () => {
    const out = addStaged([inst('x', 'P1', 2, true)], [inst('y', 'P1', 3, true)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ instanceId: 'x', quantity: 5 });
  });

  it('appends new printings and leaves unstaged search rows alone', () => {
    const out = addStaged([inst('x', 'P1', 1, false)], [inst('y', 'P1', 1, true), inst('z', 'P2', 1, true)]);
    expect(out.map(i => i.instanceId).sort()).toEqual(['x', 'y', 'z']);
    expect(out.find(i => i.instanceId === 'x')?.isStaged).toBe(false);
  });
});
