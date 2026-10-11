// lib/scan/banner/find-banners.ts — find card NAME banners (light horizontal bars) in a photo. Pure TS: runs in
// the browser (canvas pixels) and in Node (sharp raw pixels).
//
// Every card has its name on a light bar near the top, outlined by a thin frame line. Mark light, low-saturation
// pixels, cut that mask along edges (so the bar separates from glare / light art / the frame), heal the letter holes
// horizontally, and keep the connected blobs that are bar-shaped. Several light thresholds (a hazy sleeve makes the
// art as bright as the banner; a stricter threshold separates them) and several scales (close binder shots vs wide
// table shots) — duplicates collapse. Non-name bars (type lines, text boxes) are found too; the name matcher rejects
// them. Tuned on the scanner experiments (photos + labels: ~/Documents/FaB-Bazaar-Notes/scan-corpus/binder).
import { components, convexHull, minAreaRect } from '../contour-detect';
import type { Point } from '../geometry';

export interface RgbImage { data: Uint8Array | Uint8ClampedArray; width: number; height: number; channels: 3 | 4 }
/** Rotated rectangle in image pixels; angle (degrees, -90..90] = direction of the banner's long axis. */
export interface BannerRect { cx: number; cy: number; w: number; h: number; angle: number }

const WORK_WIDTHS = [1000, 2000, 3000];                      // never upscales past the input width
const LIGHT: Array<[number, number]> = [[140, 90], [175, 70], [200, 55], [115, 110]];   // [min value, max saturation] 0..255
const MIN_LEN = 90, MAX_LEN = 380;                            // banner length at a work scale
const MIN_RATIO = 4, MAX_RATIO = 16, MIN_FILL = 0.4, MIN_AREA = 400;
const MAX_TILT = 35, SIDEWAYS_FROM = 55;                      // loose cards tilt; binder cards can sit sideways

interface Work { w: number; h: number; value: Uint8Array; sat: Uint8Array; gray: Uint8Array }

function toWork(img: RgbImage, width: number): Work {
  const k = width / img.width, w = width, h = Math.max(1, Math.round(img.height * k)), c = img.channels;
  const value = new Uint8Array(w * h), sat = new Uint8Array(w * h), gray = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y / k), y1 = Math.max(y0 + 1, Math.floor((y + 1) / k));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x / k), x1 = Math.max(x0 + 1, Math.floor((x + 1) / k));
      let r = 0, g = 0, b = 0, n = 0;                         // area average (box filter) for downscaling
      for (let yy = y0; yy < Math.min(y1, img.height); yy++) for (let xx = x0; xx < Math.min(x1, img.width); xx++) {
        const i = (yy * img.width + xx) * c; r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
      }
      r /= n; g /= n; b /= n;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), i = y * w + x;
      value[i] = mx; sat[i] = mx > 0 ? Math.round(((mx - mn) / mx) * 255) : 0; gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
  }
  return { w, h, value, sat, gray };
}

/** Canny (3x3 blur, Sobel L1, non-max suppression, hysteresis 40/120), dilated 3x3. */
function edgeBarrier(gray: Uint8Array, w: number, h: number): Uint8Array {
  const sm = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    sm[i] = (gray[i - w - 1] + 2 * gray[i - w] + gray[i - w + 1] + 2 * gray[i - 1] + 4 * gray[i] + 2 * gray[i + 1] + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1]) / 16;
  }
  const mag = new Float32Array(w * h), dir = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = -sm[i - w - 1] + sm[i - w + 1] - 2 * sm[i - 1] + 2 * sm[i + 1] - sm[i + w - 1] + sm[i + w + 1];
    const gy = -sm[i - w - 1] - 2 * sm[i - w] - sm[i - w + 1] + sm[i + w - 1] + 2 * sm[i + w] + sm[i + w + 1];
    mag[i] = Math.abs(gx) + Math.abs(gy);
    const a = ((Math.atan2(gy, gx) * 180 / Math.PI) % 180 + 180) % 180;
    dir[i] = a < 22.5 || a >= 157.5 ? 0 : a < 67.5 ? 1 : a < 112.5 ? 2 : 3;
  }
  const thin = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, m = mag[i]; if (m < 40) continue;
    const [p, q] = dir[i] === 0 ? [mag[i - 1], mag[i + 1]] : dir[i] === 1 ? [mag[i - w - 1], mag[i + w + 1]] : dir[i] === 2 ? [mag[i - w], mag[i + w]] : [mag[i - w + 1], mag[i + w - 1]];
    if (m >= p && m >= q) thin[i] = m >= 120 ? 2 : 1;
  }
  const edge = new Uint8Array(w * h), stack: number[] = [];
  for (let i = 0; i < thin.length; i++) if (thin[i] === 2) { edge[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop()!, x = i % w, y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx; if (thin[j] === 1 && !edge[j]) { edge[j] = 1; stack.push(j); }
    }
  }
  return morph(edge, w, h, 1, 1, true);
}

/** Binary dilation (grow=true) or erosion with a (2*ry+1) x (2*rx+1) rectangle, separable. */
function morph(src: Uint8Array, w: number, h: number, ry: number, rx: number, grow: boolean): Uint8Array {
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = grow ? 0 : 1;
    for (let d = -rx; d <= rx; d++) { const xx = x + d; const s = xx < 0 || xx >= w ? (grow ? 0 : 1) : src[y * w + xx]; if (grow ? s : !s) { v = grow ? 1 : 0; break; } }
    tmp[y * w + x] = v;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = grow ? 0 : 1;
    for (let d = -ry; d <= ry; d++) { const yy = y + d; const s = yy < 0 || yy >= h ? (grow ? 0 : 1) : tmp[yy * w + x]; if (grow ? s : !s) { v = grow ? 1 : 0; break; } }
    out[y * w + x] = v;
  }
  return out;
}

function bars(work: Work, k: number): BannerRect[] {
  const { w, h } = work, barrier = edgeBarrier(work.gray, w, h), out: BannerRect[] = [];
  for (const [vMin, sMax] of LIGHT) {
    let mask: Uint8Array = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = work.value[i] > vMin && work.sat[i] < sMax && !barrier[i] ? 1 : 0;
    mask = morph(morph(mask, w, h, 1, 4, true), w, h, 1, 4, false);          // close 3x9: heal letter holes horizontally
    for (const pts of components(mask, w, h, MIN_AREA)) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (Math.max(x1 - x0, y1 - y0) > MAX_LEN * 1.1) continue;              // too big to be a banner (skip the hull)
      const q = minAreaRect(convexHull(pts as Point[])); if (!q) continue;
      const e1: Point = [q[1][0] - q[0][0], q[1][1] - q[0][1]], e2: Point = [q[3][0] - q[0][0], q[3][1] - q[0][1]];
      const l1 = Math.hypot(...e1), l2 = Math.hypot(...e2);
      const [len, thick, axis] = l1 >= l2 ? [l1, l2, e1] : [l2, l1, e2];
      let angle = Math.atan2(axis[1], axis[0]) * 180 / Math.PI; angle = ((angle + 90) % 180 + 180) % 180 - 90;
      const fill = pts.length / Math.max(len * thick, 1);
      if (Math.abs(angle) > MAX_TILT && Math.abs(angle) < SIDEWAYS_FROM) continue;
      if (len <= MIN_LEN || len >= MAX_LEN || len / Math.max(thick, 1) <= MIN_RATIO || len / Math.max(thick, 1) >= MAX_RATIO || fill < MIN_FILL) continue;
      const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
      out.push({ cx: cx / k, cy: cy / k, w: len / k, h: thick / k, angle });
    }
  }
  return out;
}

export function findBanners(img: RgbImage): BannerRect[] {
  const widths = [...new Set(WORK_WIDTHS.map(ww => Math.min(ww, img.width)))];
  const all = widths.flatMap(ww => bars(toWork(img, ww), ww / img.width));
  const keep: BannerRect[] = [];                                             // same bar under several thresholds/scales
  for (const b of all.sort((a, c) => c.w - a.w)) if (!keep.some(o => Math.hypot(b.cx - o.cx, b.cy - o.cy) < 0.3 * o.w)) keep.push(b);
  return keep;
}

/** Bilinear-sample a rotated source rectangle (srcW x srcH around cx,cy, tilted by `angle`) into an outW x outH RGB image. */
function sampleRotated(img: RgbImage, cx: number, cy: number, angle: number, srcW: number, srcH: number, outW: number, outH: number): RgbImage {
  const c = img.channels, a = angle * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
  const sx = srcW / outW, sy = srcH / outH, out = new Uint8Array(outW * outH * 3);
  for (let j = 0; j < outH; j++) for (let i = 0; i < outW; i++) {
    const u = (i - outW / 2 + 0.5) * sx, v = (j - outH / 2 + 0.5) * sy;
    const x = Math.min(img.width - 1.001, Math.max(0, cx + u * ux + v * vx)), y = Math.min(img.height - 1.001, Math.max(0, cy + u * uy + v * vy));
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    for (let ch = 0; ch < 3; ch++) {
      const p = (yy: number, xx: number) => img.data[(yy * img.width + xx) * c + ch];
      out[(j * outW + i) * 3 + ch] = Math.round(p(y0, x0) * (1 - fx) * (1 - fy) + p(y0, x0 + 1) * fx * (1 - fy) + p(y0 + 1, x0) * (1 - fx) * fy + p(y0 + 1, x0 + 1) * fx * fy);
    }
  }
  return { data: out, width: outW, height: outH, channels: 3 };
}

/** Straightened RGB crop of a banner (4% / 25% padding), at the photo's own resolution. */
export function cutBanner(img: RgbImage, r: BannerRect): RgbImage {
  const W = Math.max(1, Math.round(r.w * 1.04)), H = Math.max(1, Math.round(r.h * 1.25));
  return sampleRotated(img, r.cx, r.cy, r.angle, W, H, W, H);
}

/** Straightened crop of any rotated region (e.g. a whole card), scaled to `outWidth` px wide — for thumbnails. */
export function cutRegion(img: RgbImage, r: BannerRect, outWidth: number): RgbImage {
  const outH = Math.max(1, Math.round(outWidth * (r.h / r.w)));
  return sampleRotated(img, r.cx, r.cy, r.angle, r.w, r.h, outWidth, outH);
}
