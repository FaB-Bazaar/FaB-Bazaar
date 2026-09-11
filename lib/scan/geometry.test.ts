// lib/scan/geometry.test.ts — homography + perspective warp (pure, grayscale planes).
import { describe, it, expect } from 'vitest';
import { computeHomography, applyHomography, warpQuadToRect, type Quad, type Point } from './geometry';

const rect = (w: number, h: number): Quad => [[0, 0], [w, 0], [w, h], [0, h]];

describe('computeHomography', () => {
  it('maps the four source corners exactly onto the four destination corners', () => {
    const src: Quad = [[10, 12], [200, 5], [210, 300], [4, 290]];
    const dst = rect(100, 140);
    const H = computeHomography(src, dst);
    for (let i = 0; i < 4; i++) {
      const p = applyHomography(H, src[i]);
      expect(p[0]).toBeCloseTo(dst[i][0], 6);
      expect(p[1]).toBeCloseTo(dst[i][1], 6);
    }
  });
  it('is the identity for identical quads', () => {
    const H = computeHomography(rect(50, 70), rect(50, 70));
    const p: Point = [13, 29];
    const q = applyHomography(H, p);
    expect(q[0]).toBeCloseTo(13, 9); expect(q[1]).toBeCloseTo(29, 9);
  });
});

describe('warpQuadToRect', () => {
  it('pulls an axis-aligned sub-rectangle out unchanged', () => {
    // 20x20 plane with a gradient; warp the [5,5]-[15,15] box to a 10x10 output
    const W = 20, H = 20; const src = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) src[y * W + x] = x * 10 + y;
    const out = warpQuadToRect(src, W, H, [[5, 5], [15, 5], [15, 15], [5, 15]], 10, 10);
    expect(out.length).toBe(100);
    // sample centres: output (0,0) ↔ source (5.5,5.5)-ish; allow bilinear tolerance
    expect(Math.abs(out[0] - (5 * 10 + 5))).toBeLessThanOrEqual(8);
    expect(Math.abs(out[9 * 10 + 9] - (14 * 10 + 14))).toBeLessThanOrEqual(8);
  });
  it('undoes a rotation: a rotated bright rectangle warps back to a uniformly bright output', () => {
    const W = 200, H = 200; const src = new Uint8Array(W * H).fill(20);
    // bright rectangle 100x140 rotated 15° about the centre
    const cx = 100, cy = 100, a = (15 * Math.PI) / 180, rw = 50, rh = 70;
    const corner = (dx: number, dy: number): Point => [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
    const quad: Quad = [corner(-rw, -rh), corner(rw, -rh), corner(rw, rh), corner(-rw, rh)];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      // inverse-rotate the pixel and test membership
      const dx = x - cx, dy = y - cy; const u = dx * Math.cos(-a) - dy * Math.sin(-a), v = dx * Math.sin(-a) + dy * Math.cos(-a);
      if (Math.abs(u) <= rw && Math.abs(v) <= rh) src[y * W + x] = 220;
    }
    const out = warpQuadToRect(src, W, H, quad, 40, 56);
    // interior (skip a 3px border for sampling blur) must be bright everywhere
    let min = 255;
    for (let y = 3; y < 53; y++) for (let x = 3; x < 37; x++) min = Math.min(min, out[y * 40 + x]);
    expect(min).toBeGreaterThan(180);
  });
});
