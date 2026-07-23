/**
 * Pure scroll-position logic for the /opt mobile command-bar collapse: the
 * header shows only near the top of the results (like the binder page, where
 * filters live at the top and scroll away). Scrolling back UP mid-list must
 * NOT bring it back — only returning to the top does.
 */
import { describe, it, expect } from 'vitest';
import { nextHeaderHidden } from './collapse-header-on-scroll';

describe('nextHeaderHidden', () => {
  it('hides once scrolled past the reveal zone', () => {
    expect(nextHeaderHidden({ top: 140 })).toBe(true);
    expect(nextHeaderHidden({ top: 81 })).toBe(true);
  });

  it('stays hidden on upward scrolls that are still mid-list', () => {
    // Previously an upward delta revealed the header anywhere; now position
    // alone decides, so scrolling up from 500 → 460 keeps it hidden.
    expect(nextHeaderHidden({ top: 460 })).toBe(true);
  });

  it('shows within the reveal zone at the top', () => {
    expect(nextHeaderHidden({ top: 40 })).toBe(false);
    expect(nextHeaderHidden({ top: 80 })).toBe(false);
    expect(nextHeaderHidden({ top: 0 })).toBe(false);
  });

  it('treats iOS rubber-band (negative tops) as top-of-list', () => {
    expect(nextHeaderHidden({ top: -30 })).toBe(false);
  });

  it('honors a custom reveal zone', () => {
    expect(nextHeaderHidden({ top: 150, revealZone: 200 })).toBe(false);
    expect(nextHeaderHidden({ top: 250, revealZone: 200 })).toBe(true);
  });
});
