/**
 * Scroll-position state for the /opt mobile command-bar collapse. Pure so the
 * page can wire it straight to the results pane's onScroll. The header shows
 * only near the top of the list — matching the binder page, where filters sit
 * at the top and scroll away. Scrolling up mid-list does NOT reveal it; only
 * returning to the top does.
 */
export interface CollapseScrollInput {
  /** scrollTop now. */
  top: number;
  /** Offset at or below which the header is shown. */
  revealZone?: number;
}

export function nextHeaderHidden({ top, revealZone = 80 }: CollapseScrollInput): boolean {
  // <= keeps iOS rubber-band negatives (and 0) in the "shown" state.
  return top > revealZone;
}
