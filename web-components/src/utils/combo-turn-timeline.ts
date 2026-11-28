/**
 * Pure timeline logic for <fab-combo-turn> (node-testable; the Lit element
 * only renders what these return). A frame index runs 0..steps.length, where
 * steps.length is the end-of-turn frame that reveals the turn totals.
 */

export interface TimelineStep { cardId: string; kind: string; outcome?: string }
export interface LaneItem { steps: number[]; stack: boolean }

/** Back-to-back attacks with the same card share one lane item (a stack). */
export function laneItems(steps: TimelineStep[]): LaneItem[] {
  const items: LaneItem[] = [];
  steps.forEach((s, i) => {
    const last = items[items.length - 1];
    const prev = steps[i - 1];
    if (last && prev && s.kind === 'attack' && prev.kind === 'attack' && prev.cardId === s.cardId) {
      last.steps.push(i);
      last.stack = true;
    } else {
      items.push({ steps: [i], stack: false });
    }
  });
  return items;
}

/** Playback speed relative to the first prototype (owner call: 1.5x). */
export const PLAYBACK_SPEED = 1.5;

/** How long a step stays up: enough to read its caption (~16 chars/s). */
export function stepHoldMs(caption: string, inStack: boolean): number {
  const floor = inStack ? 1800 : 2400;
  return Math.round(Math.max(floor, 900 + caption.length * 60) / PLAYBACK_SPEED);
}

export interface Frame {
  /** Last step index shown. */
  visibleUpTo: number;
  atEnd: boolean;
  /** The card the counter tracks: the one with the biggest stack, if any. */
  counterCardId: string | null;
  attackCount: number;
}

export function frameAt(steps: TimelineStep[], index: number): Frame {
  const atEnd = index >= steps.length;
  const visibleUpTo = Math.min(Math.max(index, 0), steps.length - 1);
  const biggest = laneItems(steps)
    .filter((it) => it.stack)
    .sort((a, b) => b.steps.length - a.steps.length)[0];
  const counterCardId = biggest ? steps[biggest.steps[0]].cardId : null;
  const attackCount = counterCardId
    ? steps.filter((s, i) => i <= visibleUpTo && s.kind === 'attack' && s.cardId === counterCardId).length
    : 0;
  return { visibleUpTo, atEnd, counterCardId, attackCount };
}
