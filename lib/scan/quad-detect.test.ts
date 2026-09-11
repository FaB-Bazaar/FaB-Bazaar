// lib/scan/quad-detect.test.ts — find the card's four corners in a photo (grayscale plane).
import { describe, it, expect } from 'vitest';
import { detectCardQuad, detectCardQuads } from './quad-detect';
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
    const base = inside(x + 0.5, y + 0.5) ? card + Math.round(25 * Math.sin(x / 23) * Math.cos(y / 19)) : bg; // soft blobs: art, not stripes
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

/** Several cards on one table (each with its own texture phase). */
function multiScene(W: number, H: number, quads: Quad[], bg = 40): Uint8Array {
  const px = new Uint8Array(W * H).fill(bg);
  let seed = 11; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px[y * W + x] = Math.max(0, Math.min(255, bg + Math.round((rnd() - 0.5) * 10)));
  quads.forEach((quad, k) => {
    const inside = (x: number, y: number) => { let sign = 0; for (let i = 0; i < 4; i++) { const [ax, ay] = quad[i], [bx, by] = quad[(i + 1) % 4]; const s = Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax)); if (s === 0) continue; if (sign === 0) sign = s; else if (s !== sign) return false; } return true; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(x + 0.5, y + 0.5)) px[y * W + x] = Math.max(0, Math.min(255, 180 + Math.round(25 * Math.sin((x + k * 7) / 23) * Math.cos(y / 19))));
  });
  return px;
}
const matchAll = (found: Quad[], truths: Quad[], tol: number) =>
  truths.every(t => found.some(f => f.every((p, i) => near(p, t[i], tol))));

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

  it('finds three cards laid side by side (detectCardQuads), each within tolerance, no phantom spans', () => {
    const W = 640, H = 300;
    const truths = [rot(110, 150, 150, 210, 3), rot(320, 150, 150, 210, -2), rot(530, 150, 150, 210, 4)];
    const found = detectCardQuads(multiScene(W, H, truths), W, H);
    expect(found).toHaveLength(3);
    expect(matchAll(found.map(f => f.quad), truths, 8)).toBe(true);
  });
  it('finds a 2×2 grid of cards', () => {
    const W = 480, H = 620;
    const truths = [rot(130, 160, 160, 224, 0), rot(350, 160, 160, 224, 0), rot(130, 460, 160, 224, 0), rot(350, 460, 160, 224, 0)];
    const found = detectCardQuads(multiScene(W, H, truths), W, H);
    expect(found).toHaveLength(4);
    expect(matchAll(found.map(f => f.quad), truths, 8)).toBe(true);
  });
  it('detectCardQuads on a single card returns exactly that one (no inner-frame duplicates)', () => {
    const W = 320, H = 400; const truth = rot(160, 200, 180, 250, 12);
    const found = detectCardQuads(scene(W, H, truth, { noise: 8 }), W, H);
    expect(found).toHaveLength(1);
  });
  it('cards near the frame edge are still found (no large margin requirement for multi-card shots)', () => {
    const W = 640, H = 300;
    const truths = [rot(90, 150, 150, 210, 0), rot(320, 150, 150, 210, 0), rot(550, 150, 150, 210, 0)]; // 15px from each side
    const found = detectCardQuads(multiScene(W, H, truths), W, H);
    expect(found).toHaveLength(3);
  });

  it('finds a single SMALL card (arm\'s-length shot: ~10% of the frame) — small is not the same as "inner feature"', () => {
    const W = 640, H = 480; const truth = rot(330, 250, 130, 182, 5); // 130×182 of 640×480 ≈ 7.7%
    const found = detectCardQuad(scene(W, H, truth, { noise: 6 }), W, H);
    expect(found).not.toBeNull();
    for (let i = 0; i < 4; i++) expect(near(found!.quad[i], truth[i], 7)).toBe(true);
  });

  it('a single card is not mistaken for a block of cards because of weak skewed sub-quads through its art', () => {
    // a card with a strong diagonal feature inside (a busy art) — the diagonal creates junk quads with the edges
    const W = 400, H = 520; const truth = rot(200, 260, 260, 364, 0);
    const px = scene(W, H, truth, { noise: 6 });
    for (let y = 100; y < 420; y++) { const x = Math.round(80 + (y - 100) * 0.7); for (let d = -2; d <= 2; d++) px[y * W + Math.min(W - 1, Math.max(0, x + d))] = 30; }
    const found = detectCardQuads(px, W, H);
    expect(found).toHaveLength(1);
    for (let i = 0; i < 4; i++) expect(near(found[0].quad[i], truth[i], 7)).toBe(true);
  });
});
