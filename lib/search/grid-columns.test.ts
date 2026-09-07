import { describe, it, expect } from 'vitest';
import { GRID_COLS_OPTIONS, gridColsClass } from './grid-columns';

describe('gridColsClass', () => {
  it('offers exactly 4, 5 and 6 wide', () => {
    expect(GRID_COLS_OPTIONS).toEqual([4, 5, 6]);
  });

  it('6 wide keeps the full responsive ramp (2 → 3 → 4 → 5 → 6)', () => {
    expect(gridColsClass(6)).toBe('grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6');
  });

  it('5 and 4 wide cap the ramp at the chosen width so tiles grow on wide screens', () => {
    expect(gridColsClass(5)).toBe('grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5');
    expect(gridColsClass(4)).toBe('grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4');
  });

  it('falls back to the 6-wide ramp for an unknown value', () => {
    expect(gridColsClass(undefined)).toBe(gridColsClass(6));
    expect(gridColsClass(9 as any)).toBe(gridColsClass(6));
  });
});
