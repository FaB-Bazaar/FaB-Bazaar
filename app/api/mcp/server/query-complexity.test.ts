/**
 * Unit tests for validateQueryComplexity — the pre-execution guard on
 * search_printings tool input.
 *
 * Key behavior: an over-limit `options.limit` is CLAMPED to the maximum, not
 * rejected. Models routinely guess limit:200 when they expect a big result
 * set; failing the call wastes a whole agent-loop iteration (1/8 of a Volzar
 * turn) on something the server can trivially fix itself.
 */

import { describe, it, expect } from 'vitest';
import { validateQueryComplexity, MAX_SEARCH_LIMIT } from './query-complexity';

describe('validateQueryComplexity — limit clamping', () => {
  it('clamps an over-limit request to MAX_SEARCH_LIMIT instead of rejecting (cards[] schema)', () => {
    const toolInput = {
      cards: [{ filters: { classes: ['necromancer'], types: ['ally'] } }],
      options: { limit: 200 },
    };

    const result = validateQueryComplexity(toolInput);

    expect(result.isValid).toBe(true);
    expect(toolInput.options.limit).toBe(MAX_SEARCH_LIMIT);
  });

  it('clamps an over-limit request on the legacy top-level-filters schema too', () => {
    const toolInput = {
      filters: { classes: ['necromancer'] },
      options: { limit: 500 },
    };

    const result = validateQueryComplexity(toolInput);

    expect(result.isValid).toBe(true);
    expect(toolInput.options.limit).toBe(MAX_SEARCH_LIMIT);
  });

  it('leaves an in-range limit untouched', () => {
    const toolInput = {
      cards: [{ filters: { name: 'pummel' } }],
      options: { limit: 50 },
    };

    const result = validateQueryComplexity(toolInput);

    expect(result.isValid).toBe(true);
    expect(toolInput.options.limit).toBe(50);
  });

  it('handles missing options without inventing a limit', () => {
    const toolInput = { cards: [{ filters: { name: 'pummel' } }] };

    const result = validateQueryComplexity(toolInput);

    expect(result.isValid).toBe(true);
    expect((toolInput as any).options?.limit).toBeUndefined();
  });
});

describe('validateQueryComplexity — genuine rejections retained', () => {
  it('still rejects absurd page numbers', () => {
    const toolInput = { filters: { name: 'pummel' }, options: { page: 1001 } };

    const result = validateQueryComplexity(toolInput);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('page');
  });

  it('still rejects large unfiltered queries (legacy schema)', () => {
    const toolInput = { filters: {}, options: { limit: 80 } };

    const result = validateQueryComplexity(toolInput);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('specific filter');
  });

  it('still rejects too-short searchable text', () => {
    const toolInput = { filters: { searchableText: 'a' }, options: {} };

    const result = validateQueryComplexity(toolInput);

    expect(result.isValid).toBe(false);
  });
});
