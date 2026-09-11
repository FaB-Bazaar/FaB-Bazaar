// lib/scan/phash.test.ts
// Pure perceptual-hash primitives for the card scanner. No sharp, no DB:
// pixels in, 64-bit hashes out. The sharp adapter (image-hash.ts) and the
// DB-backed index build on these.
import { describe, it, expect } from 'vitest';
import { pHash, dHash, hamming, rankByDistance, HASH_SIZE } from './phash';

/** Synthetic 32x32 grayscale: a smooth diagonal gradient with a bright block. */
function synthetic(seed = 0): Uint8Array {
  const px = new Uint8Array(HASH_SIZE * HASH_SIZE);
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      let v = ((x + y) * 4 + seed * 37) % 256;
      if (x > 8 + seed && x < 20 + seed && y > 4 && y < 12) v = 240;
      px[y * HASH_SIZE + x] = v;
    }
  }
  return px;
}

/** 3x3 box blur, the kind of degradation a phone photo introduces. */
function blur(px: Uint8Array): Uint8Array {
  const out = new Uint8Array(px.length);
  const n = HASH_SIZE;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let sum = 0, cnt = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy < 0 || yy >= n || xx < 0 || xx >= n) continue;
        sum += px[yy * n + xx]; cnt++;
      }
      out[y * n + x] = Math.round(sum / cnt);
    }
  }
  return out;
}

describe('pHash / dHash', () => {
  it('returns a 16-char lowercase hex string (64 bits)', () => {
    const h = pHash(synthetic());
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(dHash(synthetic())).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic for identical pixels', () => {
    expect(pHash(synthetic())).toBe(pHash(synthetic()));
    expect(dHash(synthetic())).toBe(dHash(synthetic()));
  });

  it('survives a blur: blurred image is within a few bits of the original', () => {
    const a = synthetic();
    expect(hamming(pHash(a), pHash(blur(a)))).toBeLessThanOrEqual(6);
    expect(hamming(dHash(a), dHash(blur(a)))).toBeLessThanOrEqual(10);
  });

  it('separates different images by many bits', () => {
    const a = synthetic(0), b = synthetic(5);
    expect(hamming(pHash(a), pHash(b))).toBeGreaterThan(12);
  });

  it('rejects pixel buffers that are not HASH_SIZE squared', () => {
    expect(() => pHash(new Uint8Array(10))).toThrow(/HASH_SIZE/);
  });
});

describe('hamming', () => {
  it('counts differing bits between two hex hashes', () => {
    expect(hamming('0000000000000000', '0000000000000000')).toBe(0);
    expect(hamming('0000000000000000', 'ffffffffffffffff')).toBe(64);
    expect(hamming('0000000000000001', '0000000000000003')).toBe(1);
    expect(hamming('8000000000000000', '0000000000000000')).toBe(1);
  });
});

describe('rankByDistance', () => {
  // distance = phash + art (0..128, equal weights); dhash is not scored (imported dataset rows have none)
  const index = [
    { id: 'far', phash: 'ffffffffffffffff', dhash: null, artHash: 'ffffffffffffffff' },
    { id: 'near', phash: '0000000000000003', dhash: null, artHash: '0000000000000001' },
    { id: 'exact', phash: '0000000000000000', dhash: null, artHash: '0000000000000000' },
  ];

  it('orders candidates by whole-card + art distance, best first', () => {
    const ranked = rankByDistance({ phash: '0000000000000000', dhash: '0000000000000000', artHash: '0000000000000000' }, index, 3);
    expect(ranked.map(r => r.id)).toEqual(['exact', 'near', 'far']);
    expect(ranked[0].distance).toBe(0);
    expect(ranked[1].distance).toBe(2 + 1);
    expect(ranked[2].distance).toBe(64 + 64);
  });

  it('honours the limit', () => {
    const ranked = rankByDistance({ phash: '0000000000000000', dhash: '0000000000000000', artHash: '0000000000000000' }, index, 1);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].id).toBe('exact');
  });

  it('falls back to 2× the whole-card distance when either side lacks an art hash', () => {
    const q = { phash: '0000000000000000', dhash: null, artHash: null };
    const ranked = rankByDistance(q, [{ id: 'a', phash: '0000000000000003', dhash: null, artHash: '0000000000000000' }], 1);
    expect(ranked[0].distance).toBe(2 * 2);
    expect(ranked[0].artDistance).toBeNull();
  });
});
