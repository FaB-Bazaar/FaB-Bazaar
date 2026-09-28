import { describe, it, expect } from 'vitest';
import { FORMATS, FORMAT_CODES } from './formats';

describe('Future Classic Constructed is retired (folded into CC, 2026-09)', () => {
  it('is not listed as a game format', () => {
    expect(FORMATS).not.toContain('future classic constructed');
  });

  it('old aliases resolve to Classic Constructed so existing links keep working', () => {
    for (const alias of ['fcc', 'future cc', 'future_cc', 'future classic constructed']) {
      expect(FORMAT_CODES[alias as keyof typeof FORMAT_CODES]).toBe('Classic Constructed');
    }
  });
});
