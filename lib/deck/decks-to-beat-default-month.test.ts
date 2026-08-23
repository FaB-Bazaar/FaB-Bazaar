import { describe, it, expect } from 'vitest';
import { resolveDecksToBeatDefaultMonth } from './decks-to-beat-default-month';

// Decks to Beat opens on the CURRENT month whenever any format has a featured
// deck in it. It only reverts to an earlier month when the current month is
// empty across ALL formats — the active format tab having no decks yet is not
// a reason to leave the current month.
describe('resolveDecksToBeatDefaultMonth', () => {
  const now = { year: 2026, month: 8 };

  it('stays on the current month when the latest featured month (any format) is the current month', () => {
    expect(resolveDecksToBeatDefaultMonth({ year: 2026, month: 8 }, now)).toEqual({ year: 2026, month: 8 });
  });

  it('reverts to the latest featured month when the current month is empty', () => {
    expect(resolveDecksToBeatDefaultMonth({ year: 2026, month: 7 }, now)).toEqual({ year: 2026, month: 7 });
    expect(resolveDecksToBeatDefaultMonth({ year: 2025, month: 11 }, now)).toEqual({ year: 2025, month: 11 });
  });

  it('stays on the current month when no featured decks exist at all', () => {
    expect(resolveDecksToBeatDefaultMonth(null, now)).toEqual({ year: 2026, month: 8 });
  });

  it('never jumps forward: a future-dated featured deck keeps the current month', () => {
    expect(resolveDecksToBeatDefaultMonth({ year: 2026, month: 9 }, now)).toEqual({ year: 2026, month: 8 });
    expect(resolveDecksToBeatDefaultMonth({ year: 2027, month: 1 }, now)).toEqual({ year: 2026, month: 8 });
  });

  it('compares year before month (Dec 2025 is earlier than Aug 2026)', () => {
    expect(resolveDecksToBeatDefaultMonth({ year: 2025, month: 12 }, now)).toEqual({ year: 2025, month: 12 });
  });
});
