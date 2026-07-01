import * as React from "react";

// Mount-guarded reads of browser-only globals.
//
// Reading `matchMedia` / `navigator` during render produces different output on
// the server (globals absent → false) than on the client's first paint, which
// triggers React #418 hydration mismatches. These hooks return the SSR-safe
// default (false) on the first render, then update in an effect after mount so
// the client's first render always matches the server HTML.

/** True on coarse-pointer (touch) devices. False during SSR and first client render. */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = React.useState(false);

  React.useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
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
