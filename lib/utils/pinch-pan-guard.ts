/**
 * Pinch-zoom pan guard.
 *
 * Radix dialogs (via react-remove-scroll) preventDefault wheel/touchmove at
 * the document level while open. Its allowPinchZoom flag whitelists the pinch
 * gesture itself (two-finger touch, ctrl+wheel) but never the PAN while
 * zoomed — single-finger drags and plain trackpad scrolls are still eaten, so
 * once pinch-zoomed the user can't move around the page.
 *
 * The fix: a window-level CAPTURE listener that stops propagation of
 * scroll-intent events whenever the visual viewport is actually zoomed
 * (scale > 1). Capture on window fires before react-remove-scroll's document
 * listeners, so the lock never sees the event and the browser pans natively.
 * At normal zoom every event passes through untouched and scroll locking
 * behaves exactly as before.
 */

// Real pinch zoom is well above this; sub-1% "scale" is float fuzz some
// browsers report at rest.
const ZOOMED_SCALE_THRESHOLD = 1.01;

/** Build the guard handler; `getScale` reads visualViewport.scale (undefined when unsupported). */
export function makePinchPanGuardHandler(getScale: () => number | undefined) {
  return (event: Event) => {
    const scale = getScale();
    if (scale !== undefined && scale > ZOOMED_SCALE_THRESHOLD) {
      event.stopPropagation();
    }
  };
}

/**
 * Install the guard on a window. Returns an uninstall function.
 * Passive capture listeners: we never preventDefault, only stop propagation.
 */
export function installPinchPanGuard(win: Window): () => void {
  const handler = makePinchPanGuardHandler(() => win.visualViewport?.scale);
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  win.addEventListener('wheel', handler, opts);
  win.addEventListener('touchmove', handler, opts);
  return () => {
    win.removeEventListener('wheel', handler, opts);
    win.removeEventListener('touchmove', handler, opts);
  };
}
