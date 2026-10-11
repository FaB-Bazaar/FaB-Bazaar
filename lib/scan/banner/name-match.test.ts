// Name matching for the banner scanner: OCR text of a card's name banner -> card name.
// Every case here is a real OCR read from a binder/table photo (scanner experiments, 2026-10).
import { describe, it, expect } from 'vitest';
import { buildNameIndex, matchName, suggestNames, ACCEPT_SCORE } from './name-match';

const index = buildNameIndex([
  { name: 'Tempestuous Kiss', pitches: [1] },
  { name: 'Hiss', pitches: [1] },
  { name: 'Sit!', pitches: [3] },
  { name: 'Gold', pitches: [null], translations: ['Or', 'Oro'] },
  { name: 'Thump', pitches: [1, 2, 3], translations: ['Rossée', 'Wumms', 'Paliza'] },
  { name: 'Perch Grapplers', pitches: [null], translations: ['Kantengreifer'] },
  { name: 'Dread Triptych', pitches: [3], translations: ['Tríptico del terror'] },
  { name: 'Mordred Tide', pitches: [1], translations: ['Mörderische Gezeitenströmung'] },
  { name: 'Plan for the Worst', pitches: [3] },
  { name: 'Lay Low', pitches: [3] },
  { name: 'Stonewall Gauntlet', pitches: [null] },
  { name: 'Stonewall Confidence', pitches: [1, 2, 3] },
  { name: 'Twelve Petal Kāṣāya', pitches: [null] },
  { name: 'Art of the Dragon: Blood', pitches: [1] },
  { name: 'Art of the Dragon: Claw', pitches: [1] },
  { name: 'Art of the Dragon: Fire', pitches: [1] },
  { name: 'Sink Below', pitches: [1, 2, 3] },
  { name: 'Shatter', pitches: [1] },
  { name: 'Bam Bam', pitches: [2] },
  { name: 'Sedate', pitches: [1, 2, 3] },
  { name: 'All In', pitches: [1] },
  { name: 'Headbutt', pitches: [1, 2, 3] },
  { name: 'Ironfist Revelation', pitches: [null] },
  { name: 'Arc Lightning', pitches: [1] },
  { name: 'Mangle', pitches: [1] },
  { name: 'Erase Face', pitches: [1] },
  { name: 'Coronet Peak', pitches: [null] },
]);

describe('matchName', () => {
  it('accepts a clean banner read', () => {
    const m = matchName(index, '( Stonewall Gauntlet )');
    expect(m.card).toBe('Stonewall Gauntlet');
    expect(m.accepted).toBe(true);
  });

  it('prefers the name that explains most of the text over a short name hiding in it', () => {
    // plain edit distance picked "Hiss" (fits the "KISS" fragment)
    expect(matchName(index, 'es fempestits KISS AN').card).toBe('Tempestuous Kiss');
  });

  it('prefers the long name over a short one on a partly garbled banner', () => {
    expect(matchName(index, '} Plan for (NAC YYW at').card).toBe('Plan for the Worst');
  });

  it('never accepts a short name from a fragment of a longer line', () => {
    const m = matchName(index, '—- Site : 3 |');            // was accepted as "Sit!"
    expect(m.accepted).toBe(false);
  });

  it('never accepts a short translated name hiding in noise', () => {
    expect(matchName(index, 'SOR,').accepted).toBe(false);        // French "Or" = Gold
    expect(matchName(index, 'CROSSES,').accepted).toBe(false);    // French "Rossée" = Thump
  });

  it('identifies a card from its translated name', () => {
    const m = matchName(index, '( Kantengreifer');
    expect(m.card).toBe('Perch Grapplers');
    expect(m.accepted).toBe(true);
    expect(matchName(index, ') Triptico del terror (i').card).toBe('Dread Triptych');
  });

  it('tolerates one OCR slip in a long translated name', () => {
    expect(matchName(index, '| Mérderische Gezeitenstromung').card).toBe('Mordred Tide');
  });

  it('matches names with accented letters', () => {
    expect(matchName(index, '( : Twelve Petal Kasaya )').card).toBe('Twelve Petal Kāṣāya');
  });

  it('does not let a wrong pitch read throw away a strong name match', () => {
    // the pips misread an equipment card as red: the name still wins (penalty, not a filter)
    const m = matchName(index, '( Stonewall Gauntlet )', { pitch: 1 });
    expect(m.card).toBe('Stonewall Gauntlet');
    expect(m.accepted).toBe(true);
  });

  it('uses the pitch read to break a near tie', () => {
    const m = matchName(index, 'Art of the Dragon. bDIV%', { pitch: 1 });
    expect(m.card.startsWith('Art of the Dragon')).toBe(true);
  });

  it('picks the best of several reads of the same banner', () => {
    const m = matchName(index, ['', '7 em"', 'Sink Below']);
    expect(m.card).toBe('Sink Below');
    expect(m.accepted).toBe(true);
  });

  it('never accepts a name read with more than one error per four letters', () => {
    // phone + corpus misreads of rules text / type lines that scored just past the cutoff
    expect(matchName(index, 'MATTERS').accepted).toBe(false);          // was accepted as "Shatter" (2 errors / 7)
    expect(matchName(index, 'Ban Bom').accepted).toBe(false);          // the "Bam Bam" phone misread pattern
  });

  it('never accepts an everyday word that explains less than half of the line', () => {
    expect(matchName(index, 'Flt SEDATE Se').accepted).toBe(false);    // rules text containing "sedate"
  });

  it('still accepts real names with banner junk around them', () => {
    expect(matchName(index, 'y) All In at')).toMatchObject({ card: 'All In', accepted: true });
    expect(matchName(index, 'y Headbutt (4')).toMatchObject({ card: 'Headbutt', accepted: true });
    expect(matchName(index, 'Ironhst Revelation')).toMatchObject({ card: 'Ironfist Revelation', accepted: true });
  });

  it('never accepts a 1-3 letter translated name (fr "Or" = Gold read from "[or ——")', () => {
    expect(matchName(index, '[or ——').accepted).toBe(false);
  });

  it('never accepts a name with a quarter of its letters wrong (type line "k 3 Lightning" -> Arc Lightning)', () => {
    expect(matchName(index, '= k 3 Lightning |').accepted).toBe(false);
  });

  it('never accepts a short name (6 letters or fewer) unless every letter matches ("Dangle" -> Mangle)', () => {
    expect(matchName(index, "' Dangle").accepted).toBe(false);
  });

  it('still accepts longer names with one or two OCR slips', () => {
    expect(matchName(index, 'D  EraseFace |')).toMatchObject({ card: 'Erase Face', accepted: true });
    expect(matchName(index, '\\ ~~ Coronel Peak')).toMatchObject({ card: 'Coronet Peak', accepted: true });
  });

  it('accepts nothing from empty or junk text', () => {
    expect(matchName(index, '').accepted).toBe(false);
    expect(matchName(index, '— — -').accepted).toBe(false);
  });

  it('reports the runner-up card for review UIs', () => {
    const m = matchName(index, 'Art of the Dragon: Blood');
    expect(m.card).toBe('Art of the Dragon: Blood');
    expect(m.runnerUp?.startsWith('Art of the Dragon')).toBe(true);
    expect(m.score).toBeLessThanOrEqual(ACCEPT_SCORE);
  });
});

describe('buildNameIndex at full size', () => {
  it('matches against ~11k names fast (the brute-force experiment took 252 ms per read)', () => {
    const many = Array.from({ length: 11000 }, (_, i) => ({ name: `Filler Card ${i.toString(36)} of the Deep`, pitches: [1] }));
    const big = buildNameIndex([...many, { name: 'Tempestuous Kiss', pitches: [1] }]);
    const reads = ['es fempestits KISS AN', '| Tempestuous Kiss', 'Tempestuous Kiss £', 'junk text here'];
    const t0 = performance.now();
    for (let i = 0; i < 25; i++) for (const r of reads) matchName(big, r);
    const perRead = (performance.now() - t0) / (25 * reads.length);
    expect(matchName(big, 'es fempestits KISS AN').card).toBe('Tempestuous Kiss');
    expect(perRead).toBeLessThan(25);
  });
});

describe('suggestNames', () => {
  const idx = buildNameIndex([
    { name: 'Astral Etchings', pitches: [1, 2, 3] },
    { name: 'Bastral Dummy', pitches: [1] },
    { name: 'Teklo Pounder', pitches: [3] },
    { name: 'Teklo Core', pitches: [null] },
    { name: 'Pounding Gale', pitches: [1] },
    { name: 'Perch Grapplers', pitches: [null], translations: ['Kantengreifer'] },
    { name: 'Massacre', pitches: [1] },
    { name: 'Hungering Slaughterbeast', pitches: [1], translations: ['Massacreur affamé'] },
  ]);
  const names = (q: string) => suggestNames(idx, q).map(s => s.name);

  it('ranks English names before another card whose TRANSLATED name matches as well', () => {
    expect(names('massac')).toEqual(['Massacre', 'Hungering Slaughterbeast']);   // typing "massac" means Massacre
  });

  it('lists names starting with what was typed first, then names containing it', () => {
    expect(names('astral')).toEqual(['Astral Etchings', 'Bastral Dummy']);
  });
  it('matches the start of any word ("pounder" -> Teklo Pounder)', () => {
    expect(names('pound')).toEqual(['Pounding Gale', 'Teklo Pounder']);
  });
  it('carries each card’s pitches for the colour dots', () => {
    expect(suggestNames(idx, 'astral')[0]).toEqual({ name: 'Astral Etchings', pitches: [1, 2, 3] });
  });
  it('finds a card by its translated name, shown in English', () => {
    expect(names('kanten')).toEqual(['Perch Grapplers']);
  });
  it('still suggests something for a typo', () => {
    expect(names('teklo poundr')[0]).toBe('Teklo Pounder');
  });
  it('suggests nothing for under 2 characters, and caps the list', () => {
    expect(names('a')).toEqual([]);
    expect(suggestNames(idx, 'e', 3)).toEqual([]);
    expect(suggestNames(idx, 'te', 1)).toHaveLength(1);
  });
});
