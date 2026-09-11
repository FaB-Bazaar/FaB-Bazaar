// lib/scan/image-hash.ts
// sharp adapter for the card scanner: any image bytes → HashPair.
// Server-only (sharp is native). The pure math lives in phash.ts.
import sharp from 'sharp';
import { HASH_SIZE, hashPair, type HashPair } from './phash';

/**
 * Hash an image buffer (jpeg/png/webp/…). The image is flattened onto a
 * neutral background, converted to grayscale and squashed to HASH_SIZE²
 * with `fit: 'fill'` — card renders and card photos are both portrait, so
 * dropping the aspect ratio costs nothing and makes crops of slightly
 * different proportions land on the same grid.
 */
export async function hashImage(input: Buffer | Uint8Array): Promise<HashPair> {
  const { data, info } = await sharp(input)
    .rotate() // honour EXIF orientation from phone cameras
    .flatten({ background: '#808080' })
    .grayscale()
    .resize(HASH_SIZE, HASH_SIZE, { fit: 'fill', kernel: 'lanczos3', fastShrinkOnLoad: false })
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 1 || data.length !== HASH_SIZE * HASH_SIZE) {
    throw new Error(`unexpected raw plane: ${info.channels} channels, ${data.length} bytes`);
  }
  return hashPair(new Uint8Array(data.buffer, data.byteOffset, data.length));
}

export type PitchHint = 'red' | 'yellow' | 'blue';

const HINT_W = 120, HINT_H = 168;
// The name banner: its tint carries the pitch colour. The corners are
// excluded on purpose — the top-right cost circle is red on every card.
const BAND_TOP = 0.03, BAND_BOTTOM = 0.15, BAND_LEFT = 0.15, BAND_RIGHT = 0.85;
const MIN_VOTE_SHARE = 0.05; // of banner pixels; below this nothing is coloured enough

function hueClass(r: number, g: number, b: number): PitchHint | null {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max < 90) return null;                 // too dark to trust
  const sat = (max - min) / max;
  if (sat < 0.45) return null;               // washed out / grey
  let h = 0;
  if (max === r) h = 60 * (((g - b) / (max - min)) % 6);
  else if (max === g) h = 60 * ((b - r) / (max - min) + 2);
  else h = 60 * ((r - g) / (max - min) + 4);
  if (h < 0) h += 360;
  if (h < 18 || h > 340) return 'red';
  if (h >= 38 && h <= 70) return 'yellow';
  if (h >= 170 && h <= 250) return 'blue'; // phone white balance drags blue toward cyan
  return null;
}

/**
 * Best-effort pitch colour from the card's top band. Returns null when no
 * colour wins clearly (heroes, equipment, generic frames, bad lighting).
 * Used only to ORDER pitch siblings in results, never to exclude them.
 */
export async function pitchHint(input: Buffer | Uint8Array): Promise<PitchHint | null> {
  const { data, info } = await sharp(input)
    .rotate()
    .flatten({ background: '#808080' })
    .resize(HINT_W, HINT_H, { fit: 'fill', fastShrinkOnLoad: false })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const votes: Record<PitchHint, number> = { red: 0, yellow: 0, blue: 0 };
  const y0 = Math.floor(info.height * BAND_TOP), y1 = Math.floor(info.height * BAND_BOTTOM);
  const x0 = Math.floor(info.width * BAND_LEFT), x1 = Math.floor(info.width * BAND_RIGHT);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * info.width + x) * info.channels;
      const c = hueClass(data[i], data[i + 1], data[i + 2]);
      if (c) votes[c]++;
    }
  }
  const ranked = (Object.entries(votes) as [PitchHint, number][]).sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  const bandPixels = (y1 - y0) * (x1 - x0);
  if (best[1] < bandPixels * MIN_VOTE_SHARE) return null; // nothing coloured enough
  if (best[1] < second[1] * 1.5) return null;         // no clear winner
  return best[0];
}

/** Small JPEG data URL of the photo (for the paired desktop's preview). */
export async function thumbnailDataUrl(input: Buffer | Uint8Array, width = 160): Promise<string> {
  const buf = await sharp(input).rotate().resize({ width }).jpeg({ quality: 70 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}
