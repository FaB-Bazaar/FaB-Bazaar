// lib/scan/contour-detect.test.ts — contour-based card detection (edges → closed
// components → convex hull → 4-corner polygon), the approach that survives a
// card whose OUTER edge vanishes on a dark mat: the inner frame is a strong
// closed contour, while a type bar or text box never closes into a card shape.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { detectCardContours } from './contour-detect';
import type { Point, Quad } from './geometry';

const FIX = path.join(__dirname, '__fixtures__');
const rot = (cx: number, cy: number, w: number, h: number, deg: number): Quad => {
  const a = (deg * Math.PI) / 180;
  const c = (dx: number, dy: number): Point => [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
  return [c(-w / 2, -h / 2), c(w / 2, -h / 2), c(w / 2, h / 2), c(-w / 2, h / 2)];
};
const near = (a: Point, b: Point, tol: number) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;
function scene(W: number, H: number, quads: Quad[], opts: { bg?: number; card?: number; noise?: number } = {}): Uint8Array {
  const { bg = 40, card = 190, noise = 6 } = opts; const px = new Uint8Array(W * H);
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const inside = (q: Quad, x: number, y: number) => { let sign = 0; for (let i = 0; i < 4; i++) { const [ax, ay] = q[i], [bx, by] = q[(i + 1) % 4]; const s = Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax)); if (s === 0) continue; if (sign === 0) sign = s; else if (s !== sign) return false; } return true; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = bg; for (let k = 0; k < quads.length; k++) if (inside(quads[k], x + 0.5, y + 0.5)) v = card + Math.round(25 * Math.sin((x + k * 7) / 23) * Math.cos(y / 19));
    px[y * W + x] = Math.max(0, Math.min(255, v + Math.round((rnd() - 0.5) * 2 * noise)));
  }
  return px;
}

describe('detectCardContours', () => {
  it('finds a tilted card on a dark table within a few px', () => {
    const W = 320, H = 400; const truth = rot(160, 200, 180, 250, 12);
    const found = detectCardContours(scene(W, H, [truth]), W, H);
    expect(found).toHaveLength(1);
    for (let i = 0; i < 4; i++) expect(near(found[0].quad[i], truth[i], 6)).toBe(true);
  });
  it('finds a card on a light background', () => {
    const W = 320, H = 400; const truth = rot(160, 200, 170, 240, -8);
    const found = detectCardContours(scene(W, H, [truth], { bg: 230, card: 90 }), W, H);
    expect(found).toHaveLength(1);
    for (let i = 0; i < 4; i++) expect(near(found[0].quad[i], truth[i], 6)).toBe(true);
  });
  it('finds three cards in a row and a 2×2 grid', () => {
    const W = 640, H = 300; const row = [rot(110, 150, 150, 210, 3), rot(320, 150, 150, 210, -2), rot(530, 150, 150, 210, 4)];
    const f1 = detectCardContours(scene(W, H, row), W, H);
    expect(f1).toHaveLength(3);
    expect(row.every(t => f1.some(f => f.quad.every((p, i) => near(p, t[i], 8))))).toBe(true);
    const W2 = 480, H2 = 620; const grid = [rot(130, 160, 160, 224, 0), rot(350, 160, 160, 224, 0), rot(130, 460, 160, 224, 0), rot(350, 460, 160, 224, 0)];
    const f2 = detectCardContours(scene(W2, H2, grid), W2, H2);
    expect(f2).toHaveLength(4);
  });
  it('finds a small arm\'s-length card and a card near the frame edge', () => {
    const W = 640, H = 480; const small = rot(330, 250, 130, 182, 5);
    expect(detectCardContours(scene(W, H, [small]), W, H)).toHaveLength(1);
    const edge = rot(90, 150, 150, 210, 0);
    expect(detectCardContours(scene(640, 300, [edge]), 640, 300)).toHaveLength(1);
  });
  it('returns nothing for noise and for a frame-filling card', () => {
    const W = 320, H = 400; const px = new Uint8Array(W * H); let seed = 3; for (let i = 0; i < px.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; px[i] = seed % 256; }
    expect(detectCardContours(px, W, H)).toHaveLength(0);
    expect(detectCardContours(new Uint8Array(W * H).fill(150), W, H)).toHaveLength(0);
  });
  it('REAL PHOTO: a card on a dark playmat whose outer edge is invisible — finds the card (inner frame or outer), not the type bar', async () => {
    const { data, info } = await sharp(path.join(FIX, 'photo-mbrio-mat.jpg')).grayscale().raw().toBuffer({ resolveWithObject: true });
    const found = detectCardContours(new Uint8Array(data), info.width, info.height);
    expect(found.length).toBeGreaterThanOrEqual(1);
    // the card spans roughly x 13–81%, y 20–91% of the 600×800 photo; accept the inner frame (a few % inside)
    const q = found[0].quad; const W = info.width, H = info.height;
    const xs = q.map(p => p[0] / W), ys = q.map(p => p[1] / H);
    expect(Math.min(...xs)).toBeGreaterThan(0.10); expect(Math.min(...xs)).toBeLessThan(0.19);
    expect(Math.max(...xs)).toBeGreaterThan(0.74); expect(Math.max(...xs)).toBeLessThan(0.84);
    expect(Math.min(...ys)).toBeGreaterThan(0.18); expect(Math.min(...ys)).toBeLessThan(0.25);
    expect(Math.max(...ys)).toBeGreaterThan(0.85); expect(Math.max(...ys)).toBeLessThan(0.93);
  });
});
