/**
 * Pinch-zoom pan guard — when the visual viewport is pinch-zoomed
 * (scale > 1), scroll-intent events must bypass any scroll lock
 * (react-remove-scroll inside Radix dialogs preventDefaults wheel/touchmove
 * at the document level, which kills panning while zoomed). The guard is a
 * window-capture listener that stops propagation of those events before the
 * lock's document listener sees them, letting the browser pan natively.
 */

import { describe, it, expect, vi } from 'vitest';
import { makePinchPanGuardHandler } from './pinch-pan-guard';

function fakeEvent() {
  return { stopPropagation: vi.fn() };
}

describe('makePinchPanGuardHandler', () => {
  it('stops propagation of scroll events while pinch-zoomed', () => {
    const handler = makePinchPanGuardHandler(() => 2.5);
    const e = fakeEvent();
    handler(e as unknown as Event);
    expect(e.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('lets events through at normal zoom (scale = 1)', () => {
    const handler = makePinchPanGuardHandler(() => 1);
    const e = fakeEvent();
    handler(e as unknown as Event);
    expect(e.stopPropagation).not.toHaveBeenCalled();
  });

  it('ignores float fuzz just above 1 (not really zoomed)', () => {
    const handler = makePinchPanGuardHandler(() => 1.005);
    const e = fakeEvent();
    handler(e as unknown as Event);
    expect(e.stopPropagation).not.toHaveBeenCalled();
  });

  it('treats a missing visualViewport scale as not zoomed', () => {
    const handler = makePinchPanGuardHandler(() => undefined);
    const e = fakeEvent();
    handler(e as unknown as Event);
    expect(e.stopPropagation).not.toHaveBeenCalled();
  });
});
