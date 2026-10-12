import { describe, it, expect } from 'vitest';
import { cardRegionFromBanner } from './review';

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
