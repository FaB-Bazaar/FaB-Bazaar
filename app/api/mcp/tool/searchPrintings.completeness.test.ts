/**
 * Completeness marker in search_printings section output.
 *
 * Volzar trace benchmarks showed models re-running an already-complete query
 * 3-5 times with cosmetic option changes (higher limit, different sort,
 * page 2) because nothing in the result said "this is everything" — burning
 * agent-loop iterations and frequently hitting the 8-call cap with no answer.
 * The section header must state completeness explicitly, and say what remains
 * when the result IS truncated.
 */

import { describe, it, expect } from 'vitest';
import { formatSearchSections } from './searchPrintings';

const printing = (n: number) => ({
  printing_id: `p${n}`,
  card_unique_id: `c${n}`,
  name: `Card ${n}`,
  set: 'sea',
  edition: 'n',
  foiling: 's',
});

describe('formatSearchSections — completeness marker', () => {
  it('declares a complete result set when every match was returned', () => {
    const [section] = formatSearchSections([
      { query: '{"classes":["necromancer"]}', total: 3, printings: [printing(1), printing(2), printing(3)] } as any,
    ]);

    expect(section).toContain('COMPLETE');
    expect(section).toMatch(/same/i); // "re-running returns the same cards"
  });

  it('flags a partial result set with the count still unreturned', () => {
    const [section] = formatSearchSections([
      { query: '{"classes":["wizard"]}', total: 250, printings: [printing(1), printing(2)] } as any,
    ]);

    expect(section).not.toContain('COMPLETE');
    expect(section).toContain('PARTIAL');
    expect(section).toContain('248');
  });

  it('leaves the no-results line free of completeness noise', () => {
    const [section] = formatSearchSections([
      { query: 'nothing', total: 0, printings: [] } as any,
    ]);

    expect(section).toContain('no results');
    expect(section).not.toContain('COMPLETE');
    expect(section).not.toContain('PARTIAL');
  });

  it('tells the model how to react to zero results instead of retrying variations', () => {
    // Benchmarks: zero-result turns spiraled — "necromancer ally" retried as
    // free text, artist names retried in 6 spellings — because "no results"
    // carried no guidance. The line must say (a) category words belong in
    // structured filters, and (b) a zero from valid filters means NONE EXIST.
    const [section] = formatSearchSections([
      { query: 'necromancer ally', total: 0, printings: [] } as any,
    ]);

    expect(section).toMatch(/filters/i); // steer free-text users to structured filters
    expect(section).toMatch(/none|no such|not exist/i); // zero from valid filters = real answer
    expect(section).toMatch(/not.*card name|aren't card names|not names/i);
  });
});
