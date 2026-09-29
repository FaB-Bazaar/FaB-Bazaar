import { describe, it, expect } from 'vitest';
import { usageClientFromUserAgent } from './usage-client';

describe('usageClientFromUserAgent', () => {
  it('keeps the full user-agent so browser-style hosts are distinguishable', () => {
    const ua = 'Mozilla/5.0 (compatible; MetaMuse/1.2; +https://example.com/bot)';
    expect(usageClientFromUserAgent(ua)).toBe(ua);
  });

  it('keeps a simple product token unchanged', () => {
    expect(usageClientFromUserAgent('claude-code/2.1.282')).toBe('claude-code/2.1.282');
  });

  it('caps the stored value at 200 characters', () => {
    expect(usageClientFromUserAgent('x'.repeat(500))).toHaveLength(200);
  });

  it('collapses whitespace and trims', () => {
    expect(usageClientFromUserAgent('  a   b \n c  ')).toBe('a b c');
  });

  it('falls back to "unknown" when the header is missing or blank', () => {
    expect(usageClientFromUserAgent(null)).toBe('unknown');
    expect(usageClientFromUserAgent('   ')).toBe('unknown');
  });
});
