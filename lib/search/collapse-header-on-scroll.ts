/**
 * Scroll-direction state for the /opt mobile command-bar collapse. Pure so the
 * page can wire it to the results pane's onScroll with a ref for prevTop.
 */
export interface CollapseScrollInput {
  /** scrollTop at the previous scroll event. */
  prevTop: number;
  /** scrollTop now. */
  top: number;
  /** Current hidden state (returned unchanged for sub-jitter deltas). */
  hidden: boolean;
  /** Offset below which the header is always shown. */
  revealZone?: number;
  /** Minimum delta before toggling — ignores momentum-settle noise. */
  jitter?: number;
}

export function nextHeaderHidden({
  prevTop, top, hidden, revealZone = 80, jitter = 4,
}: CollapseScrollInput): boolean {
  // Near the top (including iOS rubber-band negatives) the header always shows.
  if (top <= revealZone) return false;
  const delta = top - prevTop;
  if (Math.abs(delta) < jitter) return hidden;
  return delta > 0;
}
