// lib/scan/hash-plan.test.ts — which printings the index builder should hash.
import { describe, it, expect } from 'vitest';
import { planHashWork } from './hash-plan';

const P = (printingId: string, imageUrl: string | null, set = 'wtr', language = 'en') => ({ printingId, imageUrl, set, language });

describe('planHashWork', () => {
  it('skips printings without an image', () => {
    const plan = planHashWork([P('a', null), P('b', 'u')], new Map(), {});
    expect(plan.flatMap(p => p.printingIds)).toEqual(['b']);
  });

  it('skips printings already hashed for the same image url, unless forced', () => {
    const hashed = new Map([['a', 'u1']]);
    expect(planHashWork([P('a', 'u1'), P('b', 'u2')], hashed, {}).flatMap(p => p.printingIds)).toEqual(['b']);
    expect(planHashWork([P('a', 'u1')], hashed, { force: true }).flatMap(p => p.printingIds)).toEqual(['a']);
  });

  it('re-hashes a printing whose image url changed', () => {
    const hashed = new Map([['a', 'old']]);
    expect(planHashWork([P('a', 'new')], hashed, {}).flatMap(p => p.printingIds)).toEqual(['a']);
  });

  it('filters by set codes (case-insensitive) when given', () => {
    const rows = [P('a', 'u', 'pen'), P('b', 'u', 'sea'), P('c', 'u', 'wtr')];
    expect(planHashWork(rows, new Map(), { sets: ['PEN', 'sea'] }).flatMap(p => p.printingIds)).toEqual(['a', 'b']);
  });

  it('dedupes by image url so identical renders are fetched once, fanned out to every printing', () => {
    const rows = [P('a', 'same'), P('b', 'same'), P('c', 'other')];
    const plan = planHashWork(rows, new Map(), {});
    expect(plan).toHaveLength(2);
    expect(plan.find(p => p.imageUrl === 'same')?.printingIds.sort()).toEqual(['a', 'b']);
  });
});
