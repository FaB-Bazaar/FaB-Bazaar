// lib/scan/phash.ts
// Pure perceptual-hash primitives for card recognition. Two 64-bit hashes per
// image, both computed from one HASH_SIZE×HASH_SIZE grayscale plane:
//   pHash — DCT low-frequency signs (robust to blur, scale, JPEG, mild tone shifts)
//   dHash — row-wise gradient signs on a 9×8 box-resample (cheap tie-breaker)
// Hashes are 16-char lowercase hex. Matching is Hamming distance (lower = closer).
// No image decoding here — see image-hash.ts for the sharp adapter.

export const HASH_SIZE = 32;
const DCT_KEEP = 8; // low-frequency block used for the pHash bits

export interface HashPair {
  phash: string;
  dhash: string;
  /** pHash of the fixed art rectangle (after deskew). Null on rows indexed before migration 0110. */
  artHash?: string | null;
}

function assertPlane(px: Uint8Array | number[]): void {
  if (px.length !== HASH_SIZE * HASH_SIZE) {
    throw new Error(`expected HASH_SIZE*HASH_SIZE (${HASH_SIZE * HASH_SIZE}) gray pixels, got ${px.length}`);
  }
}

// Cosine table for the 1-D DCT-II of length HASH_SIZE, only the DCT_KEEP
// output frequencies we ever read.
const COS: number[][] = Array.from({ length: DCT_KEEP }, (_, u) =>
  Array.from({ length: HASH_SIZE }, (_, x) => Math.cos(((2 * x + 1) * u * Math.PI) / (2 * HASH_SIZE))),
);

function bitsToHex(bits: number[]): string {
  let out = '';
  for (let i = 0; i < 64; i += 4) {
    const nibble = (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3];
    out += nibble.toString(16);
  }
  return out;
}

/** pHash of a HASH_SIZE² grayscale plane (row-major, 0..255). */
export function pHash(px: Uint8Array | number[]): string {
  assertPlane(px);
  // Separable 2-D DCT restricted to the DCT_KEEP×DCT_KEEP low-frequency corner.
  const rows: number[][] = []; // rows[y][u]
  for (let y = 0; y < HASH_SIZE; y++) {
    const r: number[] = [];
    for (let u = 0; u < DCT_KEEP; u++) {
      let s = 0;
      for (let x = 0; x < HASH_SIZE; x++) s += px[y * HASH_SIZE + x] * COS[u][x];
      r.push(s);
    }
    rows.push(r);
  }
  const coeffs: number[] = []; // [v*DCT_KEEP + u]
  for (let v = 0; v < DCT_KEEP; v++) {
    for (let u = 0; u < DCT_KEEP; u++) {
      let s = 0;
      for (let y = 0; y < HASH_SIZE; y++) s += rows[y][u] * COS[v][y];
      coeffs.push(s);
    }
  }
  // Median of the block excluding the DC term, so overall brightness cancels.
  const sorted = coeffs.slice(1).sort((a, b) => a - b);
  const median = (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2;
  const bits = coeffs.map((c, i) => (i === 0 ? 0 : c > median ? 1 : 0));
  return bitsToHex(bits);
}

/** Box-resample a srcW×srcH plane to w×h by averaging (pure; used for the 32×32 hash input too). */
export function resamplePlane(px: ArrayLike<number>, srcW: number, srcH: number, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    const y0 = Math.floor((j * srcH) / h), y1 = Math.max(y0 + 1, Math.floor(((j + 1) * srcH) / h));
    for (let i = 0; i < w; i++) {
      const x0 = Math.floor((i * srcW) / w), x1 = Math.max(x0 + 1, Math.floor(((i + 1) * srcW) / w));
      let s = 0, n = 0;
      for (let y = y0; y < y1 && y < srcH; y++) for (let x = x0; x < x1 && x < srcW; x++) { s += px[y * srcW + x]; n++; }
      out[j * w + i] = n ? Math.round(s / n) : 0;
    }
  }
  return out;
}

function boxResample(px: Uint8Array | number[], w: number, h: number): number[] {
  return Array.from(resamplePlane(px, HASH_SIZE, HASH_SIZE, w, h));
}

/** dHash of a HASH_SIZE² grayscale plane: 9×8 resample, sign of horizontal gradient. */
export function dHash(px: Uint8Array | number[]): string {
  assertPlane(px);
  const small = boxResample(px, 9, 8);
  const bits: number[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits.push(small[y * 9 + x] < small[y * 9 + x + 1] ? 1 : 0);
  }
  return bitsToHex(bits);
}

export function hashPair(px: Uint8Array | number[]): HashPair {
  return { phash: pHash(px), dhash: dHash(px) };
}

function popcount64(v: bigint): number {
  let n = 0;
  while (v) { v &= v - BigInt(1); n++; }
  return n;
}

/** Hamming distance between two 16-char hex hashes (0..64). */
export function hamming(a: string, b: string): number {
  return popcount64(BigInt('0x' + a) ^ BigInt('0x' + b));
}

export interface HashIndexEntry extends HashPair {
  id: string;
}

export interface RankedMatch {
  id: string;
  /** 0..256: 2×art + phash + dhash (art falls back to the whole-card mean when either side lacks it). */
  distance: number;
  phashDistance: number;
  dhashDistance: number;
  artDistance: number | null;
}

/** Max combined distance (see RankedMatch.distance). */
export const MAX_DISTANCE = 256;

/** Rank an index by combined Hamming distance to `query` — art hash weighted double. */
export function rankByDistance(query: HashPair, index: readonly HashIndexEntry[], limit: number): RankedMatch[] {
  const qp = BigInt('0x' + query.phash), qd = BigInt('0x' + query.dhash);
  const qa = query.artHash ? BigInt('0x' + query.artHash) : null;
  const scored: RankedMatch[] = index.map(e => {
    const phashDistance = popcount64(qp ^ BigInt('0x' + e.phash));
    const dhashDistance = popcount64(qd ^ BigInt('0x' + e.dhash));
    const artDistance = qa !== null && e.artHash ? popcount64(qa ^ BigInt('0x' + e.artHash)) : null;
    const art = artDistance ?? (phashDistance + dhashDistance) / 2;
    return { id: e.id, distance: 2 * art + phashDistance + dhashDistance, phashDistance, dhashDistance, artDistance };
  });
  scored.sort((a, b) => a.distance - b.distance || a.phashDistance - b.phashDistance);
  return scored.slice(0, limit);
}
