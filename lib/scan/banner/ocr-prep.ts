// lib/scan/banner/ocr-prep.ts — prepare a cut banner for Tesseract. The reader tries several preparations and keeps
// whichever matches a card name best: on clean, legible banners Tesseract returned NOTHING for the plain crop (the
// dark rounded banner ends + no margin), and the trimmed + padded version read them.
import type { RgbImage } from './find-banners';

function grayResized(img: RgbImage, x0: number, y0: number, w: number, h: number, outH: number): { g: Float32Array; W: number; H: number } {
  const H = outH, W = Math.max(1, Math.round(w * (outH / h))), g = new Float32Array(W * H), c = img.channels;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = Math.min(img.width - 1.001, x0 + ((i + 0.5) * w) / W - 0.5), y = Math.min(img.height - 1.001, y0 + ((j + 0.5) * h) / H - 0.5);
    const xa = Math.max(0, Math.floor(x)), ya = Math.max(0, Math.floor(y)), fx = Math.max(0, x - xa), fy = Math.max(0, y - ya);
    const lum = (xx: number, yy: number) => { const k = (yy * img.width + xx) * c; return 0.299 * img.data[k] + 0.587 * img.data[k + 1] + 0.114 * img.data[k + 2]; };
    g[j * W + i] = lum(xa, ya) * (1 - fx) * (1 - fy) + lum(xa + 1, ya) * fx * (1 - fy) + lum(xa, ya + 1) * (1 - fx) * fy + lum(xa + 1, ya + 1) * fx * fy;
  }
  return { g, W, H };
}

function toRgb(g: Float32Array, W: number, H: number): RgbImage {
  const data = new Uint8Array(W * H * 3);
  for (let i = 0; i < g.length; i++) { const v = Math.max(0, Math.min(255, Math.round(g[i]))); data[i * 3] = data[i * 3 + 1] = data[i * 3 + 2] = v; }
  return { data, width: W, height: H, channels: 3 };
}

/** Contrast stretch between the 1st and 99th percentile (sharp's normalize()). */
function stretch(g: Float32Array): Float32Array {
  const sorted = Float32Array.from(g).sort();
  const lo = sorted[Math.floor(sorted.length * 0.01)], hi = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
  if (hi - lo < 1) return g;
  return g.map(v => ((v - lo) * 255) / (hi - lo));
}

/** Grayscale, 90px tall, contrast-stretched. */
export function prepStretched(img: RgbImage): RgbImage {
  const { g, W, H } = grayResized(img, 0, 0, img.width, img.height, 90);
  return toRgb(stretch(g), W, H);
}

/** Banner ends trimmed (6% each side, 15% top/bottom), grayscale, 70px tall, 30px white margin. */
export function prepTrimmedPadded(img: RgbImage): RgbImage {
  const x0 = Math.round(img.width * 0.06), y0 = Math.round(img.height * 0.15);
  const { g, W, H } = grayResized(img, x0, y0, Math.max(1, img.width - 2 * x0), Math.max(1, img.height - 2 * y0), 70);
  const M = 30, OW = W + 2 * M, OH = H + 2 * M, out = new Float32Array(OW * OH).fill(255);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[(y + M) * OW + x + M] = g[y * W + x];
  return toRgb(out, OW, OH);
}

/** Upside down (a sideways card's banner can come out either way up). */
export function rotate180(img: RgbImage): RgbImage {
  const { width: W, height: H, channels: c } = img, data = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = (y * W + x) * c, d = ((H - 1 - y) * W + (W - 1 - x)) * 3;
    data[d] = img.data[s]; data[d + 1] = img.data[s + 1]; data[d + 2] = img.data[s + 2];
  }
  return { data, width: W, height: H, channels: 3 };
}
