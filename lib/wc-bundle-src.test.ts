import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { wcBundleSrc } from './wc-bundle-src';

const hash = (b: Buffer | string) => createHash('sha256').update(b).digest('hex').slice(0, 12);

describe('wcBundleSrc (the web-component <script> URL)', () => {
  it('carries a content hash, so a new build is a new URL (no 4h stale cache)', () => {
    expect(wcBundleSrc(() => Buffer.from('build one'))).toBe(`/wc/fabbazaar-ui.js?v=${hash('build one')}`);
  });

  it('changes when the bundle changes, and only then', () => {
    const a = wcBundleSrc(() => Buffer.from('build one'));
    expect(wcBundleSrc(() => Buffer.from('build two'))).not.toBe(a);
    expect(wcBundleSrc(() => Buffer.from('build one'))).toBe(a);
  });

  it('falls back to the plain URL when the file cannot be read (never a broken tag)', () => {
    expect(wcBundleSrc(() => { throw new Error('ENOENT'); })).toBe('/wc/fabbazaar-ui.js');
  });

  it('by default hashes the real public bundle', () => {
    const real = readFileSync(join(process.cwd(), 'public/wc/fabbazaar-ui.js'));
    expect(wcBundleSrc()).toBe(`/wc/fabbazaar-ui.js?v=${hash(real)}`);
  });
});
