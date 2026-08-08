/**
 * Minimal image-width sniffing for the formats Cloudflare Images delivers
 * (JPEG, PNG, WebP). Width is all the resolution-upgrade tooling needs, so
 * this stays dependency-free rather than pulling in sharp/image-size.
 */
export function imageWidth(bytes: Uint8Array): number | null {
  if (bytes.length < 10) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // PNG: signature then IHDR — width at offset 16.
  if (dv.getUint32(0) === 0x89504e47 && bytes.length >= 24) {
    return dv.getUint32(16);
  }

  // JPEG: walk markers to the first SOF0-SOF15 frame header.
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let off = 2;
    while (off + 9 < bytes.length) {
      if (bytes[off] !== 0xff) return null;
      const marker = bytes[off + 1];
      // Standalone markers without a length segment.
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { off += 2; continue; }
      const len = dv.getUint16(off + 2);
      // SOF0..SOF15, excluding DHT (C4), JPG (C8), DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return dv.getUint16(off + 7);
      }
      off += 2 + len;
    }
    return null;
  }

  // WebP: RIFF….WEBP, then VP8X (extended), VP8 (lossy), or VP8L (lossless).
  if (dv.getUint32(0) === 0x52494646 && bytes.length >= 30 && dv.getUint32(8) === 0x57454250) {
    const fourcc = dv.getUint32(12);
    if (fourcc === 0x56503858) { // VP8X — 24-bit little-endian width-1 at 24
      return 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    }
    if (fourcc === 0x56503820) { // "VP8 " — 14-bit width at frame offset 26
      return dv.getUint16(26, true) & 0x3fff;
    }
    if (fourcc === 0x5650384c) { // VP8L — 14-bit width-1 after signature byte
      const b = dv.getUint32(21, true);
      return 1 + (b & 0x3fff);
    }
  }

  return null;
}
