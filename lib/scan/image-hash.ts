// lib/scan/image-hash.ts
// sharp adapter for the card scanner: any image bytes → HashPair.
// Server-only (sharp is native). The pure math lives in phash.ts.
import sharp from 'sharp';
import { HASH_SIZE, dHash, resamplePlane, type HashPair } from './phash';
import { exactPHash, decimalToHex, FULL_BBOX, ART_BBOX } from './phash-exact';
import { detectCardQuad, detectCardQuads } from './quad-detect';
import { warpQuadToRect, computeHomography, applyHomography, type Quad } from './geometry';

// Working resolution for analysis (longest edge) and the deskewed card plane.
const WORK_MAX = 1000;
const CARD_W = 400, CARD_H = 560;
// Canonical card frame = the OUTER card edge (what a full-bleed render and a
// frame-filling photo both show). A photo's quad may be detected at the outer
// edge (border→table, contrast-dependent) or the inner edge (border→frame,
// always crisp); an inner quad is grown by the border so both land on the
// same frame. Measured on the Cloudflare renders (300×419: 12.6px, 12.5px).
const BORDER_X = 0.042, BORDER_Y = 0.030;
const MIN_QUAD_CONFIDENCE = 0.5;
// A single card on a table has background on every side; a quad hugging the frame
// on a one-card shot is a partial/inner feature of a frame-filling card → flat path.
const SINGLE_MIN_MARGIN = 0.05;
const hasMargin = (q: Quad, w: number, h: number, m: number) => q.every(([x, y]) => x >= m * w && x <= (1 - m) * w && y >= m * h && y <= (1 - m) * h);
// Outer-vs-inner classification: mean luminance of a thin band just inside the quad.
const BORDER_BAND = [0.008, 0.025] as const;
// The black border is judged RELATIVE to the card's own interior (a blurred border
// on a dark table reads ~70-90, not ~10) as well as against an absolute ceiling.
const INTERIOR_BAND = [0.12, 0.4] as const;
const OUTER_MAX_LUMA = 95;   // band inside the quad this dark (and ≤ 0.75× interior) → the quad is the OUTER edge
const BORDER_MAX_LUMA = 60;  // band outside the quad this dark (and ≤ 0.6× interior) → the quad is the INNER edge

export interface CardPlanes {
  gray: Uint8Array; r: Uint8Array; g: Uint8Array; b: Uint8Array; w: number; h: number;
  /** true when a card quad was found and the planes are the deskewed card. */
  deskewed: boolean;
  /** When deskewed: the same photo taken flat (frame = card), for the do-no-harm comparison. */
  flat?: CardPlanes;
}

export interface AnalyzeOptions {
  /** Find + warp the card quad (photos). The index builder passes false: renders are already flat and full-bleed. */
  deskew?: boolean;
}

type Plane = Uint8Array;

function warpAll(planes: Plane[], w: number, h: number, quad: Quad): Plane[] {
  return planes.map(p => warpQuadToRect(p, w, h, quad, CARD_W, CARD_H));
}

/** Mean luminance of the band `from..to` (fractions) inside the edges of a CARD_W×CARD_H plane. */
function bandLuma(gray: Plane, from: number, to: number): number {
  let s = 0, n = 0;
  const x0 = Math.floor(CARD_W * from), x1 = Math.floor(CARD_W * to), y0 = Math.floor(CARD_H * from), y1 = Math.floor(CARD_H * to);
  for (let y = 0; y < CARD_H; y++) for (let x = 0; x < CARD_W; x++) {
    const inBand = (x >= x0 && x < x1) || (x >= CARD_W - x1 && x < CARD_W - x0) || (y >= y0 && y < y1) || (y >= CARD_H - y1 && y < CARD_H - y0);
    const inOuter = x >= x0 && x < CARD_W - x0 && y >= y0 && y < CARD_H - y0;
    if (inBand && inOuter) { s += gray[y * CARD_W + x]; n++; }
  }
  return n ? s / n : 255;
}

/** The quad grown outward by the border fractions (in the quad's own projective frame). */
function expandQuad(quad: Quad, fx: number, fy: number): Quad {
  const H = computeHomography([[0, 0], [1, 0], [1, 1], [0, 1]], quad);
  return [applyHomography(H, [-fx, -fy]), applyHomography(H, [1 + fx, -fy]), applyHomography(H, [1 + fx, 1 + fy]), applyHomography(H, [-fx, 1 + fy])];
}

interface Decoded { gray: Plane; r: Plane; g: Plane; b: Plane; w: number; h: number }

async function decode(input: Buffer | Uint8Array): Promise<Decoded> {
  const { data, info } = await sharp(input)
    .rotate()
    .flatten({ background: '#808080' })
    .resize(WORK_MAX, WORK_MAX, { fit: 'inside', withoutEnlargement: true, fastShrinkOnLoad: false })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, n = w * h;
  const r = new Uint8Array(n), g = new Uint8Array(n), b = new Uint8Array(n), gray = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    r[i] = data[i * 3]; g[i] = data[i * 3 + 1]; b[i] = data[i * 3 + 2];
    gray[i] = Math.round(0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i]);
  }
  return { gray, r, g, b, w, h };
}

/** Flat planes: the frame IS the outer card edge (full-bleed render, or a frame-filling shot). */
function flatPlanes(d: Decoded): CardPlanes {
  const [cg, cr, cgg, cb] = warpAll([d.gray, d.r, d.g, d.b], d.w, d.h, [[0, 0], [d.w, 0], [d.w, d.h], [0, d.h]]);
  return { gray: cg, r: cr, g: cgg, b: cb, w: CARD_W, h: CARD_H, deskewed: false };
}

/**
 * Card-space planes for one detected quad, normalised to the OUTER edge, or
 * null when the quad is neither the outer nor the inner border (an inner
 * frame line / text box) — the black border must sit just inside or just
 * outside a real card edge.
 */
function planesForQuad(d: Decoded, quad: Quad): CardPlanes | null {
  const [cg, cr, cgg, cb] = warpAll([d.gray, d.r, d.g, d.b], d.w, d.h, quad);
  const interior = bandLuma(cg, INTERIOR_BAND[0], INTERIOR_BAND[1]);
  const inside = bandLuma(cg, BORDER_BAND[0], BORDER_BAND[1]);
  if (inside < OUTER_MAX_LUMA && inside <= interior * 0.75) {
    return { gray: cg, r: cr, g: cgg, b: cb, w: CARD_W, h: CARD_H, deskewed: true };
  }
  const grown = expandQuad(quad, BORDER_X / (1 - 2 * BORDER_X), BORDER_Y / (1 - 2 * BORDER_Y));
  const [og, or_, ogg, ob] = warpAll([d.gray, d.r, d.g, d.b], d.w, d.h, grown);
  const outside = bandLuma(og, BORDER_BAND[0], BORDER_BAND[1]);
  if (outside < BORDER_MAX_LUMA && outside <= interior * 0.6) {
    return { gray: og, r: or_, g: ogg, b: ob, w: CARD_W, h: CARD_H, deskewed: true };
  }
  return null;
}

/** Decode, EXIF-rotate, find + deskew the card if visible, return canonical (outer-frame) card planes. */
export async function cardPlanes(input: Buffer | Uint8Array, opts: AnalyzeOptions = {}): Promise<CardPlanes> {
  const d = await decode(input);
  const found = opts.deskew === false ? null : detectCardQuad(d.gray, d.w, d.h);
  if (found && found.confidence >= MIN_QUAD_CONFIDENCE && hasMargin(found.quad, d.w, d.h, SINGLE_MIN_MARGIN)) {
    const p = planesForQuad(d, found.quad);
    if (p) return { ...p, flat: flatPlanes(d) };
  }
  return flatPlanes(d);
}

/** Small JPEG data URL of card-space RGB planes (the per-card thumbnail for the desktop). */
async function planesThumb(p: CardPlanes, width = 160): Promise<string> {
  const rgb = Buffer.alloc(p.w * p.h * 3);
  for (let i = 0; i < p.w * p.h; i++) { rgb[i * 3] = p.r[i]; rgb[i * 3 + 1] = p.g[i]; rgb[i * 3 + 2] = p.b[i]; }
  const buf = await sharp(rgb, { raw: { width: p.w, height: p.h, channels: 3 } }).resize({ width }).jpeg({ quality: 70 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

/**
 * Index-compatible hashes from card-space planes: the fab-cube dataset's exact
 * whole-card and art-rect pHashes (so imported dataset rows match photos), plus
 * our gradient hash of the whole card (informational).
 */
export function hashesFromPlanes(p: CardPlanes): Required<HashPair> {
  const n = p.w * p.h;
  const rgb = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) { rgb[i * 3] = p.r[i]; rgb[i * 3 + 1] = p.g[i]; rgb[i * 3 + 2] = p.b[i]; }
  const img = { data: rgb, width: p.w, height: p.h, channels: 3 };
  const whole = resamplePlane(p.gray, p.w, p.h, HASH_SIZE, HASH_SIZE);
  return {
    phash: decimalToHex(exactPHash(img, FULL_BBOX)),
    dhash: dHash(whole),
    artHash: decimalToHex(exactPHash(img, ART_BBOX)),
  };
}

export interface ImageAnalysis {
  hashes: Required<HashPair>;
  pitchHint: PitchHint | null;
  deskewed: boolean;
  /** Present when deskewed: the flat-frame alternative (match both, keep the closer — see pickBetterIdentification). */
  flatHashes?: Required<HashPair>;
  flatPitchHint?: PitchHint | null;
  /** Per-card JPEG data URL (the deskewed card), when produced by analyzeImageMulti. */
  thumb?: string | null;
}

/**
 * Several cards in one photo: one analysis per detected card, in reading
 * order, each with its own thumbnail. A single detected card also carries the
 * flat-frame alternative (do-no-harm); with none found, one flat analysis.
 */
export async function analyzeImageMulti(input: Buffer | Uint8Array, opts: { maxCards?: number } = {}): Promise<ImageAnalysis[]> {
  const d = await decode(input);
  let quads = detectCardQuads(d.gray, d.w, d.h, { maxCards: opts.maxCards ?? 12 }).filter(q => q.confidence >= MIN_QUAD_CONFIDENCE);
  // a lone quad on a one-card shot must have background all round (a quad hugging the frame is an
  // inner feature of a frame-filling card); small is fine — an arm's-length card is ~8% of the frame
  if (quads.length === 1 && !hasMargin(quads[0].quad, d.w, d.h, SINGLE_MIN_MARGIN)) quads = [];
  const planes = quads.map(q => planesForQuad(d, q.quad)).filter((p): p is CardPlanes => p !== null);
  if (planes.length === 0) {
    const flat = flatPlanes(d);
    return [{ hashes: hashesFromPlanes(flat), pitchHint: pitchHintFromPlanes(flat), deskewed: false, thumb: null }];
  }
  const out: ImageAnalysis[] = [];
  for (const p of planes) {
    const a: ImageAnalysis = { hashes: hashesFromPlanes(p), pitchHint: pitchHintFromPlanes(p), deskewed: true, thumb: await planesThumb(p) };
    if (planes.length === 1) { const flat = flatPlanes(d); a.flatHashes = hashesFromPlanes(flat); a.flatPitchHint = pitchHintFromPlanes(flat); }
    out.push(a);
  }
  return out;
}

/** One decode → deskew → hashes + pitch hint. The route uses this; hashImage/pitchHint are thin wrappers. */
export async function analyzeImage(input: Buffer | Uint8Array, opts: AnalyzeOptions = {}): Promise<ImageAnalysis> {
  const planes = await cardPlanes(input, opts);
  const out: ImageAnalysis = { hashes: hashesFromPlanes(planes), pitchHint: pitchHintFromPlanes(planes), deskewed: planes.deskewed };
  if (planes.flat) { out.flatHashes = hashesFromPlanes(planes.flat); out.flatPitchHint = pitchHintFromPlanes(planes.flat); }
  return out;
}

/** Hash an image buffer (jpeg/png/webp/…), deskewing the card first when it can be found. */
export async function hashImage(input: Buffer | Uint8Array, opts: AnalyzeOptions = {}): Promise<Required<HashPair>> {
  return hashesFromPlanes(await cardPlanes(input, opts));
}

export type PitchHint = 'red' | 'yellow' | 'blue';

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
 * Best-effort pitch colour from the card's name banner. Returns null when no
 * colour wins clearly (heroes, equipment, generic frames, bad lighting).
 * Used only to ORDER pitch siblings in results, never to exclude them.
 */
export function pitchHintFromPlanes(p: CardPlanes): PitchHint | null {
  const votes: Record<PitchHint, number> = { red: 0, yellow: 0, blue: 0 };
  const y0 = Math.floor(p.h * BAND_TOP), y1 = Math.floor(p.h * BAND_BOTTOM);
  const x0 = Math.floor(p.w * BAND_LEFT), x1 = Math.floor(p.w * BAND_RIGHT);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * p.w + x;
      const c = hueClass(p.r[i], p.g[i], p.b[i]);
      if (c) votes[c]++;
    }
  }
  const ranked = (Object.entries(votes) as [PitchHint, number][]).sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  const bandPixels = (y1 - y0) * (x1 - x0);
  if (best[1] < bandPixels * MIN_VOTE_SHARE) return null;
  if (best[1] < second[1] * 1.5) return null;
  return best[0];
}

export async function pitchHint(input: Buffer | Uint8Array): Promise<PitchHint | null> {
  return pitchHintFromPlanes(await cardPlanes(input));
}

/** Small JPEG data URL of the photo (for the paired desktop's preview). */
export async function thumbnailDataUrl(input: Buffer | Uint8Array, width = 160): Promise<string> {
  const buf = await sharp(input).rotate().resize({ width }).jpeg({ quality: 70 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}
