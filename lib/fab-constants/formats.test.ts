import { describe, it, expect } from 'vitest';
import { FORMATS, FORMAT_CODES } from './formats';

describe('Future Classic Constructed format constants', () => {
  it('is listed as a game format', () => {
    expect(FORMATS).toContain('future classic constructed');
  });

  it('resolves every shorthand alias to the display name', () => {
    for (const alias of ['fcc', 'future cc', 'future_cc', 'future classic constructed']) {
      expect(FORMAT_CODES[alias as keyof typeof FORMAT_CODES]).toBe('Future Classic Constructed');
    }
  });
});
