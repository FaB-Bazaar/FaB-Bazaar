import { describe, it, expect } from 'vitest';
import { laneItems, stepHoldMs, frameAt } from './combo-turn-timeline';

const atk = (cardId: string, outcome = 'hit') => ({ cardId, kind: 'attack', outcome });
const act = (cardId: string) => ({ cardId, kind: 'action' });

// The Viserai turn's shape: one Mechanoid swing, Hit the Gas, four more, Prong Bot.
const steps = [act('construct'), atk('mech'), act('gas'), atk('mech', 'no-hit'), atk('mech'), atk('mech'), atk('mech'), atk('prong')];

describe('laneItems', () => {
  it('stacks back-to-back attacks with the same card; anything in between splits the stack', () => {
    expect(laneItems(steps)).toEqual([
      { steps: [0], stack: false },
      { steps: [1], stack: false },
      { steps: [2], stack: false },
      { steps: [3, 4, 5, 6], stack: true },
      { steps: [7], stack: false },
    ]);
  });

  it('never stacks two plays of a non-attack', () => {
    expect(laneItems([act('a'), act('a')])).toEqual([{ steps: [0], stack: false }, { steps: [1], stack: false }]);
  });
});

describe('stepHoldMs', () => {
  it('holds long enough to read the caption, at 1.5x the prototype pace', () => {
    expect(stepHoldMs('', false)).toBe(1600); // 2400 floor / 1.5
    expect(stepHoldMs('', true)).toBe(1200); // 1800 floor inside a stack / 1.5
    expect(stepHoldMs('x'.repeat(100), false)).toBe(4600); // (900 + 100*60) / 1.5
  });
});

describe('frameAt', () => {
  it('counts attacks with the stacked card and reveals turn totals only at the end', () => {
    expect(frameAt(steps, 0)).toMatchObject({ visibleUpTo: 0, attackCount: 0, atEnd: false });
    expect(frameAt(steps, 4)).toMatchObject({ visibleUpTo: 4, attackCount: 3, counterCardId: 'mech', atEnd: false });
    // index steps.length = the end-of-turn frame
    expect(frameAt(steps, 8)).toMatchObject({ visibleUpTo: 7, attackCount: 5, atEnd: true });
  });

  it('has no counter when nothing attacks more than once', () => {
    expect(frameAt([act('a'), atk('b')], 2)).toMatchObject({ attackCount: 0, counterCardId: null });
  });
});
