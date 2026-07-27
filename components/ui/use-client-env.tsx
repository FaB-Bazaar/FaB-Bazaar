import * as React from "react";

// Mount-guarded reads of browser-only globals.
//
// Reading `matchMedia` / `navigator` during render produces different output on
// the server (globals absent → false) than on the client's first paint, which
// triggers React #418 hydration mismatches. These hooks return the SSR-safe
// default (false) on the first render, then update in an effect after mount so
// the client's first render always matches the server HTML.

const TOUCH_OVERRIDE_KEY = "fabb:force-touch";

/**
 * Developer escape hatch for driving phone-only UI from a desktop browser.
 *
 * Chrome DevTools' free-form "Responsive" mode emulates a phone-sized viewport
 * but not touch, so `(pointer: coarse)` stays false and touch-gated UI (the deck
 * tile action sheet) never opens — you get the desktop click behaviour instead.
 * Appending `?touch=1` forces touch mode on and remembers the choice, so it
 * survives navigation; `?touch=0` forces it off, `?touch=auto` restores real
 * detection.
 *
 * Returns null when no override is set, so real detection still wins by default.
 */
function readTouchOverride(): boolean | null {
  try {
    const param = new URLSearchParams(window.location.search).get("touch");
    if (param === "1") { window.localStorage.setItem(TOUCH_OVERRIDE_KEY, "1"); return true; }
    if (param === "0") { window.localStorage.setItem(TOUCH_OVERRIDE_KEY, "0"); return false; }
    if (param === "auto") { window.localStorage.removeItem(TOUCH_OVERRIDE_KEY); return null; }

    const stored = window.localStorage.getItem(TOUCH_OVERRIDE_KEY);
    return stored === "1" ? true : stored === "0" ? false : null;
  } catch {
    return null; // private-mode localStorage, malformed URL — fall back to detection
  }
}

/** True on coarse-pointer (touch) devices. False during SSR and first client render. */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = React.useState(false);

  React.useEffect(() => {
    setIsTouch(readTouchOverride() ?? window.matchMedia("(pointer: coarse)").matches);
  }, []);

  return isTouch;
}

/** True on macOS/iPadOS platforms. False during SSR and first client render. */
export function useIsMac(): boolean {
  const [isMac, setIsMac] = React.useState(false);

  React.useEffect(() => {
    setIsMac(/Mac/.test(navigator.platform));
  }, []);

  return isMac;
}
