// lib/scan/quad-detect.test.ts — find the card's four corners in a photo (grayscale plane).
import { describe, it, expect } from 'vitest';
import { detectCardQuad } from './quad-detect';
import type { Point, Quad } from './geometry';

function scene(W: number, H: number, quad: Quad, opts: { bg?: number; card?: number; noise?: number } = {}): Uint8Array {
  const { bg = 40, card = 190, noise = 0 } = opts;
  const px = new Uint8Array(W * H);
  const inside = (x: number, y: number) => {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = quad[i], [bx, by] = quad[(i + 1) % 4];
      const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
      const s = Math.sign(cross); if (s === 0) continue;
      if (sign === 0) sign = s; else if (s !== sign) return false;
    }
    return true;
  };
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const base = inside(x + 0.5, y + 0.5) ? card + Math.round(30 * Math.sin(x / 9) * Math.cos(y / 7)) : bg;
    px[y * W + x] = Math.max(0, Math.min(255, base + Math.round((rnd() - 0.5) * 2 * noise)));
  }
  return px;
}
const rot = (cx: number, cy: number, w: number, h: number, deg: number): Quad => {
  const a = (deg * Math.PI) / 180;
  const c = (dx: number, dy: number): Point => [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
  return [c(-w / 2, -h / 2), c(w / 2, -h / 2), c(w / 2, h / 2), c(-w / 2, h / 2)];
};
const near = (a: Point, b: Point, tol: number) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;

describe('detectCardQuad', () => {
  it('finds a tilted card on a dark table, corners ordered TL,TR,BR,BL within a few px', () => {
    const W = 320, H = 400; const truth = rot(160, 200, 180, 250, 12);
    const found = detectCardQuad(scene(W, H, truth, { noise: 8 }), W, H);
    expect(found).not.toBeNull();
    for (let i = 0; i < 4; i++) expect(near(found!.quad[i], truth[i], 6)).toBe(true);
  });
  it('finds a card on a LIGHT background too (edges, not brightness)', () => {
    const W = 320, H = 400; const truth = rot(160, 200, 170, 240, -8);
    const found = detectCardQuad(scene(W, H, truth, { bg: 230, card: 90, noise: 6 }), W, H);
    expect(found).not.toBeNull();
    for (let i = 0; i < 4; i++) expect(near(found!.quad[i], truth[i], 6)).toBe(true);
  });
  it('handles a mild perspective (trapezoid) — corners within tolerance', () => {
    const W = 320, H = 400; const truth: Quad = [[80, 70], [250, 60], [270, 350], [60, 340]];
    const found = detectCardQuad(scene(W, H, truth, { noise: 5 }), W, H);
    expect(found).not.toBeNull();
    for (let i = 0; i < 4; i++) expect(near(found!.quad[i], truth[i], 7)).toBe(true);
  });
  it('returns null when there is no card-like quadrilateral', () => {
    const W = 320, H = 400; const px = new Uint8Array(W * H);
    let seed = 3; for (let i = 0; i < px.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; px[i] = seed % 256; }
    expect(detectCardQuad(px, W, H)).toBeNull();
  });
  it('returns null when the card fills the whole frame (nothing to deskew)', () => {
    const W = 320, H = 400; const px = new Uint8Array(W * H).fill(150);
    expect(detectCardQuad(px, W, H)).toBeNull();
  });
});
