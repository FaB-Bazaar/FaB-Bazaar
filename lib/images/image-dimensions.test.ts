import { describe, it, expect } from "vitest";
import { imageWidth } from "./image-dimensions";

// Minimal hand-built headers for the three formats Cloudflare Images delivers
// (JPEG for legacy uploads, PNG, WebP). Width is all the upgrade script needs.

function jpegWithSof(width: number, height: number): Uint8Array {
  // SOI, APP0 (empty-ish), SOF0 with the given dimensions.
  return new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0, length 4
    0xff, 0xc0, 0x00, 0x0b, 0x08, // SOF0, length 11, precision
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, // components
  ]);
}

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // signature
  b.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8); // IHDR len+tag
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

function webpVp8x(width: number, height: number): Uint8Array {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46]); // RIFF
  b.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  b.set([0x56, 0x50, 0x38, 0x58], 12); // VP8X
  const w = width - 1, h = height - 1;
  b[24] = w & 0xff; b[25] = (w >> 8) & 0xff; b[26] = (w >> 16) & 0xff;
  b[27] = h & 0xff; b[28] = (h >> 8) & 0xff; b[29] = (h >> 16) & 0xff;
  return b;
}

describe("imageWidth", () => {
  it("reads JPEG SOF width", () => {
    expect(imageWidth(jpegWithSof(300, 419))).toBe(300);
  });

  it("reads PNG IHDR width", () => {
    expect(imageWidth(png(546, 763))).toBe(546);
  });

  it("reads WebP VP8X canvas width", () => {
    expect(imageWidth(webpVp8x(546, 763))).toBe(546);
  });

  it("returns null for unrecognized bytes", () => {
    expect(imageWidth(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]))).toBeNull();
  });
});
