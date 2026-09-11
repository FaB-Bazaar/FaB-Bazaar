// lib/scan/image-hash.test.ts
// sharp adapter: image bytes → HashPair. Fixtures are real card renders
// (300px JPEGs of the Cloudflare images). "Phone photos" are simulated by
// degrading a fixture: downscale, JPEG, blur, small rotation, brightness.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { hashImage, pitchHint, analyzeImage } from './image-hash';
import { rankByDistance, hamming, type HashIndexEntry } from './phash';

const FIX = path.join(__dirname, '__fixtures__');
const FILES = ['WTR001-UL', 'WTR150-RF-UL', 'WTR215-UL', 'WTR216-UL', 'WTR217-UL'];
// Sink Below red/yellow/blue share the art; pitch is only a banner tint the
// hash can't see, so they form one indistinguishable group (see pitchHint).
const SIBLINGS = ['WTR215-UL', 'WTR216-UL', 'WTR217-UL'];
const DISTINCT = ['WTR001-UL', 'WTR150-RF-UL'];

async function phoneLike(buf: Buffer, opts: { rotate?: number; blur?: number; brightness?: number } = {}) {
  return sharp(buf)
    .rotate(opts.rotate ?? 2.5, { background: '#333' })
    .modulate({ brightness: opts.brightness ?? 0.85 })
    .blur(opts.blur ?? 1.2)
    .resize({ width: 220 })
    .jpeg({ quality: 55 })
    .toBuffer();
}

describe('hashImage', () => {
  let index: HashIndexEntry[];

  beforeAll(async () => {
    index = [];
    for (const id of FILES) {
      const h = await hashImage(fs.readFileSync(path.join(FIX, `${id}.jpg`)), { deskew: false }); // index side: renders are flat
      index.push({ id, ...h });
    }
  });

  it('returns phash + dhash + artHash, 16 hex chars each', async () => {
    const h = await hashImage(fs.readFileSync(path.join(FIX, 'WTR001-UL.jpg')));
    expect(h.phash).toMatch(/^[0-9a-f]{16}$/);
    expect(h.dhash).toMatch(/^[0-9a-f]{16}$/);
    expect(h.artHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is stable across re-encodes of the same render (png vs jpeg): at most decoder noise', async () => {
    const jpg = fs.readFileSync(path.join(FIX, 'WTR001-UL.jpg'));
    const png = await sharp(jpg).png().toBuffer();
    const a = await hashImage(jpg), b = await hashImage(png);
    // libjpeg decodes at a reduced DCT scale when the target is tiny, so a
    // JPEG and its lossless PNG copy differ by a few bits. Different cards
    // sit 10+ bits apart (see the margin tests below), so this is harmless.
    expect(hamming(a.phash, b.phash)).toBeLessThanOrEqual(4);
    expect(hamming(a.dhash, b.dhash)).toBeLessThanOrEqual(4);
  });

  it.each(DISTINCT)('ranks a phone-like degraded %s first among the fixtures, with a margin', async (id) => {
    const query = await hashImage(await phoneLike(fs.readFileSync(path.join(FIX, `${id}.jpg`))));
    const ranked = rankByDistance(query, index, 5);
    expect(ranked[0].id).toBe(id);
    expect(ranked[1].distance - ranked[0].distance).toBeGreaterThanOrEqual(10);
  });

  it.each(SIBLINGS)('ranks the pitch-sibling group first for a phone-like degraded %s', async (id) => {
    const query = await hashImage(await phoneLike(fs.readFileSync(path.join(FIX, `${id}.jpg`))));
    const ranked = rankByDistance(query, index, 5);
    expect(new Set(ranked.slice(0, 3).map(r => r.id))).toEqual(new Set(SIBLINGS));
    expect(ranked[3].distance - ranked[2].distance).toBeGreaterThanOrEqual(10);
  });

  it('keeps a harshly degraded card within the accept threshold of its own render', async () => {
    const orig = index.find(e => e.id === 'WTR216-UL')!;
    const query = await hashImage(await phoneLike(fs.readFileSync(path.join(FIX, 'WTR216-UL.jpg')), { rotate: 4, blur: 2 }));
    expect(rankByDistance(query, [orig], 1)[0].distance).toBeLessThanOrEqual(80); // 0..256 scale (art ×2 + whole)
  });

  it('rejects bytes that are not an image', async () => {
    await expect(hashImage(Buffer.from('not an image'))).rejects.toThrow();
  });
});

describe('pitchHint', () => {
  // Pitch colour is a small region (cost/pitch circles + name banner tint),
  // so this is a best-effort ordering hint, never a hard filter.
  it.each([['WTR215-UL', 'red'], ['WTR216-UL', 'yellow'], ['WTR217-UL', 'blue']])(
    'reads %s as %s on a clean render', async (id, pitch) => {
      const { pitchHint } = await import('./image-hash');
      expect(await pitchHint(fs.readFileSync(path.join(FIX, `${id}.jpg`)))).toBe(pitch);
    });

  it.each([['WTR215-UL', 'red'], ['WTR216-UL', 'yellow'], ['WTR217-UL', 'blue']])(
    'still reads %s as %s on a phone-like degrade', async (id, pitch) => {
      const { pitchHint } = await import('./image-hash');
      expect(await pitchHint(await phoneLike(fs.readFileSync(path.join(FIX, `${id}.jpg`))))).toBe(pitch);
    });

  it('returns null for a card with no pitch colour (hero)', async () => {
    const { pitchHint } = await import('./image-hash');
    expect(await pitchHint(fs.readFileSync(path.join(FIX, 'WTR001-UL.jpg')))).toBeNull();
  });

});

/** A fixture card photographed on a table: rotated, perspective-ish scale, background around it, blur, JPEG. */
async function tableScene(buf: Buffer, rotate = 9, bg = '#5a4632') {
  const card = await sharp(buf).resize({ width: 260 }).toBuffer();
  const rotated = await sharp(card).rotate(rotate, { background: bg }).toBuffer();
  const m = await sharp(rotated).metadata();
  return sharp({ create: { width: m.width! + 120, height: m.height! + 100, channels: 3, background: bg } })
    .composite([{ input: rotated, left: 60, top: 50 }])
    .modulate({ brightness: 0.9 }).blur(0.8).jpeg({ quality: 60 }).toBuffer();
}

describe('analyzeImage on a table scene (deskew + art region)', () => {
  it('finds and deskews the card, so the art hash lands close to the clean render', async () => {
    const clean = await hashImage(fs.readFileSync(path.join(FIX, 'WTR001-UL.jpg')), { deskew: false });
    const scene = await tableScene(fs.readFileSync(path.join(FIX, 'WTR001-UL.jpg')));
    const a = await analyzeImage(scene);
    expect(a.deskewed).toBe(true);
    expect(hamming(a.hashes.artHash!, clean.artHash!)).toBeLessThanOrEqual(20);
    expect(hamming(a.hashes.phash, clean.phash)).toBeLessThanOrEqual(18);
  });

  it.each(DISTINCT)('ranks %s first from a table scene with a clear margin', async (id) => {
    const index: HashIndexEntry[] = [];
    for (const f of FILES) index.push({ id: f, ...(await hashImage(fs.readFileSync(path.join(FIX, `${f}.jpg`)), { deskew: false })) });
    const a = await analyzeImage(await tableScene(fs.readFileSync(path.join(FIX, `${id}.jpg`)), -7));
    const ranked = rankByDistance(a.hashes, index, 5);
    expect(ranked[0].id).toBe(id);
    expect(ranked[1].distance - ranked[0].distance).toBeGreaterThanOrEqual(16);
  });

  it.each([['WTR215-UL', 'red'], ['WTR216-UL', 'yellow'], ['WTR217-UL', 'blue']])('still reads the pitch of %s as %s after deskew', async (id, pitch) => {
    const a = await analyzeImage(await tableScene(fs.readFileSync(path.join(FIX, `${id}.jpg`)), 6));
    expect(a.deskewed).toBe(true);
    expect(a.pitchHint).toBe(pitch);
  });

  it('leaves a frame-filling photo alone (no quad) and still hashes it', async () => {
    const a = await analyzeImage(fs.readFileSync(path.join(FIX, 'WTR150-RF-UL.jpg')));
    expect(a.deskewed).toBe(false);
    expect(a.hashes.artHash).toMatch(/^[0-9a-f]{16}$/);
  });
});
