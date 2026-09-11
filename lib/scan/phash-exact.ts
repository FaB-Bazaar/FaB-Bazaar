// lib/scan/phash-exact.ts — the fab-cube dataset's 64-bit pHash, reproduced
// bit for bit from its documented recipe (IAmThermite/flesh-and-blood-cards,
// helper-scripts/calculate-phashes/README.md) so the dataset's precomputed
// `phash_full` / `phash_art` values can be used as our index directly:
//   crop (fractions of the upright card) → 32×32 AREA-AVERAGE grayscale
//   (cells floor..ceil, 0.299R+0.587G+0.114B) → unnormalised DCT-II →
//   8×8 low-frequency block → median of the 63 non-DC coefficients →
//   leading 0 bit + 63 threshold bits, MSB first → decimal string.
// Pure TS (no sharp) so it runs in the browser too.

export interface RgbImage { data: Uint8Array | Uint8ClampedArray; width: number; height: number; channels?: number }
export interface BBox { x: number; y: number; w: number; h: number }

export const DCT_SIZE = 32;
export const HASH_SIZE = 8;
export const FULL_BBOX: BBox = { x: 0, y: 0, w: 1, h: 1 };
export const ART_BBOX: BBox = { x: 0.10, y: 0.16, w: 0.80, h: 0.42 };

const COS: number[][] = Array.from({ length: DCT_SIZE }, (_, u) =>
  Array.from({ length: DCT_SIZE }, (_, x) => Math.cos(((2 * x + 1) * u * Math.PI) / (2 * DCT_SIZE))),
);

/** Crop by fractions (rounded like the reference), then area-average to DCT_SIZE² grayscale. */
export function cropResizeGray(img: RgbImage, bbox: BBox): Float64Array {
  const ch = img.channels ?? 3;
  const cropW = Math.max(Math.round(img.width * bbox.w), 1);
  const cropH = Math.max(Math.round(img.height * bbox.h), 1);
  const x0c = Math.round(img.width * bbox.x), y0c = Math.round(img.height * bbox.y);
  const n = DCT_SIZE;
  const gray = new Float64Array(n * n);
  for (let oy = 0; oy < n; oy++) {
    const y0 = Math.max(0, Math.floor((oy * cropH) / n));
    const y1 = Math.max(y0 + 1, Math.min(cropH, Math.ceil(((oy + 1) * cropH) / n)));
    for (let ox = 0; ox < n; ox++) {
      const x0 = Math.max(0, Math.floor((ox * cropW) / n));
      const x1 = Math.max(x0 + 1, Math.min(cropW, Math.ceil(((ox + 1) * cropW) / n)));
      let r = 0, g = 0, b = 0, cnt = 0;
      for (let y = y0; y < y1; y++) {
        const row = (y0c + y) * img.width;
        for (let x = x0; x < x1; x++) {
          const i = (row + x0c + x) * ch;
          r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; cnt++;
        }
      }
      gray[oy * n + ox] = 0.299 * (r / cnt) + 0.587 * (g / cnt) + 0.114 * (b / cnt);
    }
  }
  return gray;
}

/** Decimal-string 64-bit hash of a DCT_SIZE² grayscale plane (reference `phash_from_gray`). */
export function pHashFromGray(gray: Float64Array): string {
  const n = DCT_SIZE;
  // rows[y][u] = Σ_x gray[y][x]·C[u][x]; then block[v][u] = Σ_y rows[y][u]·C[v][y]  (= C·G·Cᵀ)
  const rows: number[][] = [];
  for (let y = 0; y < n; y++) {
    const r: number[] = [];
    for (let u = 0; u < HASH_SIZE; u++) { let s = 0; for (let x = 0; x < n; x++) s += gray[y * n + x] * COS[u][x]; r.push(s); }
    rows.push(r);
  }
  const coeffs: number[] = [];
  for (let v = 0; v < HASH_SIZE; v++) for (let u = 0; u < HASH_SIZE; u++) {
    if (u === 0 && v === 0) continue;
    let s = 0; for (let y = 0; y < n; y++) s += rows[y][u] * COS[v][y];
    coeffs.push(s);
  }
  const sorted = [...coeffs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]; // 63 values → the middle one (numpy median of an odd count)
  const ONE = BigInt(1), ZERO = BigInt(0);
  let value = ZERO; // leading 0 for the DC term
  for (const c of coeffs) value = (value << ONE) | (c > median ? ONE : ZERO);
  return value.toString();
}

export function exactPHash(img: RgbImage, bbox: BBox): string {
  return pHashFromGray(cropResizeGray(img, bbox));
}

export function decimalToHex(decimal: string): string {
  return BigInt(decimal).toString(16).padStart(16, '0');
}
export function hexToDecimal(hex: string): string {
  return BigInt('0x' + hex).toString();
}
