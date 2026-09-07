import { describe, it, expect } from 'vitest';
import { effectiveSearchQuery } from './effective-query';

describe('effectiveSearchQuery', () => {
  it('passes the debounced query through in Name and Text scope', () => {
    expect(effectiveSearchQuery('name', 'snatch')).toBe('snatch');
    expect(effectiveSearchQuery('text', 'go again')).toBe('go again');
  });

  it('is empty in Volzar scope — the text is a question for Volzar, not a filter, until Enter', () => {
    expect(effectiveSearchQuery('volzar', 'blue ninja go again')).toBe('');
  });
});
