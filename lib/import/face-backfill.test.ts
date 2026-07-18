import { describe, it, expect } from 'vitest';
import { pairBackFaces } from './face-backfill';

// fab-cube encodes double-sided prints as two printing entries whose image
// filenames differ only by a back marker: X.webp / X_BACK.webp (modern),
// X_Back.png (Dynasty-era), X_A_Back.png (Uprising invocations).
describe('pairBackFaces', () => {
  const e = (uid: string, image: string) => ({ uid, image: `https://cdn.example/x/${image}` });

  it('pairs modern _BACK markers', () => {
    const { pairs } = pairBackFaces([e('f1', 'IAR159-MV.webp'), e('b1', 'IAR159-MV_BACK.webp')]);
    expect(pairs).toEqual([{ frontUid: 'f1', backUid: 'b1' }]);
  });

  it('pairs _Back and _A_Back markers (legacy casings)', () => {
    const { pairs } = pairBackFaces([
      e('f1', 'DYN092.png'), e('b1', 'DYN092_Back.png'),
      e('f2', 'UPR006.png'), e('b2', 'UPR006_A_Back.png'),
    ]);
    expect(pairs).toEqual(expect.arrayContaining([
      { frontUid: 'f1', backUid: 'b1' },
      { frontUid: 'f2', backUid: 'b2' },
    ]));
    expect(pairs).toHaveLength(2);
  });

  it('reports orphan backs (no matching front filename) instead of guessing', () => {
    const { pairs, orphans } = pairBackFaces([e('b1', 'SEA255_BACK.webp')]);
    expect(pairs).toEqual([]);
    expect(orphans).toEqual(['b1']);
  });

  it('reports ambiguity when two entries share the front filename', () => {
    const { pairs, ambiguous } = pairBackFaces([
      e('f1', 'MST158.webp'), e('f1dup', 'MST158.webp'), e('b1', 'MST158_BACK.webp'),
    ]);
    expect(pairs).toEqual([]);
    expect(ambiguous).toContain('b1');
  });

  it('disambiguates same-image variants by the attribute key', () => {
    // fab-cube reuses one art file across foiling variants — a bare filename
    // match is ambiguous, but (set|collector|edition|foiling) keys pair them.
    const k = (uid: string, image: string, key: string) => ({ uid, image: `https://cdn.example/x/${image}`, key });
    const { pairs, ambiguous } = pairBackFaces([
      k('f-s', 'MST158.webp', 'mst|MST158|n|s'),
      k('f-r', 'MST158.webp', 'mst|MST158|n|r'),
      k('b-s', 'MST158_BACK.webp', 'mst|MST158|n|s'),
      k('b-r', 'MST158_BACK.webp', 'mst|MST158|n|r'),
    ]);
    expect(pairs).toEqual(expect.arrayContaining([
      { frontUid: 'f-s', backUid: 'b-s' },
      { frontUid: 'f-r', backUid: 'b-r' },
    ]));
    expect(pairs).toHaveLength(2);
    expect(ambiguous).toEqual([]);
  });

  it('still reports ambiguity when keys cannot split the candidates', () => {
    const k = (uid: string, image: string, key: string) => ({ uid, image: `https://cdn.example/x/${image}`, key });
    const { pairs, ambiguous } = pairBackFaces([
      k('f1', 'X.webp', 'same'), k('f2', 'X.webp', 'same'), k('b1', 'X_BACK.webp', 'same'),
    ]);
    expect(pairs).toEqual([]);
    expect(ambiguous).toContain('b1');
  });

  it('ignores single-faced entries entirely', () => {
    const { pairs, orphans, ambiguous } = pairBackFaces([e('f1', 'WTR001.webp')]);
    expect(pairs).toEqual([]);
    expect(orphans).toEqual([]);
    expect(ambiguous).toEqual([]);
  });
});
