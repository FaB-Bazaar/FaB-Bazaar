import { describe, it, expect } from 'vitest';
import { prepStretched, prepTrimmedPadded, rotate180 } from './ocr-prep';
import type { RgbImage } from './find-banners';

// 200x40 banner: dark text-ish left half (value 60), cream right half (value 200)
function banner(): RgbImage {
  const w = 200, h = 40, data = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.fill(x < 100 ? 60 : 200, (y * w + x) * 3, (y * w + x) * 3 + 3);
  return { data, width: w, height: h, channels: 3 };
}
const px = (img: RgbImage, x: number, y: number) => img.data[(y * img.width + x) * img.channels];

describe('prepStretched', () => {
  it('scales to 90px tall keeping the aspect ratio', () => {
    const out = prepStretched(banner());
    expect(out.height).toBe(90);
    expect(out.width).toBe(450);
  });
  it('stretches contrast to the full 0..255 range', () => {
    const out = prepStretched(banner());
    expect(px(out, 10, 45)).toBe(0);
    expect(px(out, 440, 45)).toBe(255);
  });
});

describe('prepTrimmedPadded', () => {
  it('trims the banner ends, scales to 70px and adds a 30px white margin', () => {
    const out = prepTrimmedPadded(banner());
    expect(out.height).toBe(70 + 60);
    expect(px(out, 5, 5)).toBe(255);                       // margin
    expect(px(out, out.width - 5, out.height - 5)).toBe(255);
    expect(px(out, 35, 65)).toBeLessThan(100);             // trimmed content starts right after the margin, dark side
  });
});

describe('rotate180', () => {
  it('turns the image upside down', () => {
    const src = banner(); const out = rotate180(src);
    expect(px(out, 0, 0)).toBe(px(src, src.width - 1, src.height - 1));
    expect(px(out, out.width - 1, 0)).toBe(px(src, 0, src.height - 1));
  });
});
