// lib/scan/geometry.ts — pure 2-D projective geometry for the card scanner:
// homography from four point pairs (DLT, 8×8 solve) and an inverse-mapped
// bilinear warp of a grayscale plane. Runs in node and the browser.

export type Point = [number, number];
/** Four corners, ordered TL, TR, BR, BL. */
export type Quad = [Point, Point, Point, Point];
/** Row-major 3×3. */
export type Homography = number[];

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new Error('degenerate homography');
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** H such that H·src[i] ≈ dst[i] (homogeneous), h33 = 1. */
export function computeHomography(src: Quad, dst: Quad): Homography {
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  return [...h, 1];
}

export function applyHomography(H: Homography, [x, y]: Point): Point {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

/**
 * Warp the quad region of a grayscale plane onto an outW×outH rectangle
 * (inverse mapping + bilinear sampling; out-of-range samples clamp).
 */
export function warpQuadToRect(src: Uint8Array | Uint8ClampedArray, w: number, h: number, quad: Quad, outW: number, outH: number): Uint8Array {
  const dstRect: Quad = [[0, 0], [outW, 0], [outW, outH], [0, outH]];
  const H = computeHomography(dstRect, quad); // output → source
  const out = new Uint8Array(outW * outH);
  const at = (x: number, y: number) => src[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let j = 0; j < outH; j++) {
    for (let i = 0; i < outW; i++) {
      const [sx, sy] = applyHomography(H, [i + 0.5, j + 0.5]);
      const x0 = Math.floor(sx - 0.5), y0 = Math.floor(sy - 0.5);
      const fx = sx - 0.5 - x0, fy = sy - 0.5 - y0;
      const v = (1 - fx) * (1 - fy) * at(x0, y0) + fx * (1 - fy) * at(x0 + 1, y0) + (1 - fx) * fy * at(x0, y0 + 1) + fx * fy * at(x0 + 1, y0 + 1);
      out[j * outW + i] = Math.round(v);
    }
  }
  return out;
}

export function quadArea(q: Quad): number {
  let s = 0;
  for (let i = 0; i < 4; i++) { const [x1, y1] = q[i], [x2, y2] = q[(i + 1) % 4]; s += x1 * y2 - x2 * y1; }
  return Math.abs(s) / 2;
}

/** Order arbitrary 4 points as TL, TR, BR, BL (by angle around the centroid, starting top-left). */
export function orderQuad(pts: Point[]): Quad {
  const cx = pts.reduce((s, p) => s + p[0], 0) / 4, cy = pts.reduce((s, p) => s + p[1], 0) / 4;
  const sorted = [...pts].sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  // atan2 order is counter-clockwise starting at -π (left); rotate so the first is top-left
  let start = 0, best = Infinity;
  for (let i = 0; i < 4; i++) { const d = sorted[i][0] + sorted[i][1]; if (d < best) { best = d; start = i; } }
  const q = [0, 1, 2, 3].map(i => sorted[(start + i) % 4]) as Quad;
  // ensure clockwise in image coords (TL → TR → BR → BL): if second point is below-left, reverse
  if (quadArea(q) > 0 && (q[1][0] - q[0][0]) * (q[3][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[3][0] - q[0][0]) < 0) {
    return [q[0], q[3], q[2], q[1]];
  }
  return q;
}
