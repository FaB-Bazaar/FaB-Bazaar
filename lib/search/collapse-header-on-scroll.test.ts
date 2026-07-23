/**
 * Pure scroll-direction logic for the /opt mobile command-bar collapse:
 * scrolling down through results hides the header (reclaiming viewport for
 * tiles), scrolling up — or being near the top — brings it back.
 */
import { describe, it, expect } from 'vitest';
import { nextHeaderHidden } from './collapse-header-on-scroll';

describe('nextHeaderHidden', () => {
  it('hides when scrolling down past the reveal zone', () => {
    expect(nextHeaderHidden({ prevTop: 100, top: 140, hidden: false })).toBe(true);
  });

  it('shows again on any meaningful upward scroll', () => {
    expect(nextHeaderHidden({ prevTop: 500, top: 460, hidden: true })).toBe(false);
  });

  it('always shows near the top, even mid-downward-flick', () => {
    expect(nextHeaderHidden({ prevTop: 10, top: 40, hidden: true })).toBe(false);
    expect(nextHeaderHidden({ prevTop: 0, top: 0, hidden: true })).toBe(false);
  });

  it('ignores sub-jitter deltas (momentum settle, sub-pixel noise)', () => {
    expect(nextHeaderHidden({ prevTop: 300, top: 302, hidden: true })).toBe(true);
    expect(nextHeaderHidden({ prevTop: 300, top: 298, hidden: false })).toBe(false);
  });

  it('treats iOS rubber-band (negative tops) as top-of-list', () => {
    expect(nextHeaderHidden({ prevTop: 5, top: -30, hidden: true })).toBe(false);
  });
});
