import { describe, it, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import path from 'node:path';
import { scanPhoto } from './scan-photo';
import { buildNameIndex } from './name-match';
import type { RgbImage } from './find-banners';

const FIXTURE = path.join(__dirname, '..', '__fixtures__', 'binder-page-9.jpg');
const index = buildNameIndex([
  { name: 'Massacre', pitches: [1] }, { name: 'Dig Up Dinner', pitches: [3] }, { name: 'Argh... Smash!', pitches: [1, 2, 3] },
]);
let img: RgbImage;
beforeAll(async () => {
  const { data, info } = await sharp(FIXTURE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  img = { data, width: info.width, height: info.height, channels: 3 };
});

describe('scanPhoto', { timeout: 30_000 }, () => {   // decodes a real photo: slow when the whole suite runs in parallel
  it('stops reading a banner at the first confident read', async () => {
    let calls = 0;
    const res = await scanPhoto(img, index, async () => { calls++; return 'Massacre'; });
    const banners = res.timings.banners;
    expect(banners).toBeGreaterThanOrEqual(9);
    expect(calls).toBe(banners);                         // one read per banner, no retries
    expect(res.cards.every(c => c.accepted && c.card === 'Massacre')).toBe(true);
  });

  it('retries with the next preparation when a read is not confident', async () => {
    let n = 0;
    const res = await scanPhoto(img, index, async () => { n++; return n % 2 === 1 ? '' : 'Dig Up Dinner'; });
    expect(res.cards.length).toBeGreaterThanOrEqual(9);
    expect(res.cards.every(c => c.accepted)).toBe(true);
    expect(n).toBe(2 * res.timings.banners);
  });

  it('reports banners it could not read as not accepted, and never invents a card', async () => {
    const res = await scanPhoto(img, index, async () => 'zzzz qqqq');
    expect(res.cards.filter(c => c.accepted)).toHaveLength(0);
  });

  it('reads an unreadable upright bar only twice (upside-down reads are for sideways cards)', async () => {
    // type lines and rules text are found as bars too and never match: 4 reads each made a page take ~40 s
    let n = 0;
    const res = await scanPhoto(img, index, async () => { n++; return 'zzzz qqqq'; });
    const sideways = res.cards.filter(c => Math.abs(c.rect.angle) >= 55).length;
    expect(n).toBe(2 * (res.timings.banners - sideways) + 4 * sideways);
  });

  it('settles pitch from the name when the card exists in one pitch, else leaves it to the user', async () => {
    let i = 0; const names = ['Massacre', 'Argh... Smash!'];
    const res = await scanPhoto(img, index, async () => names[i++ % 2]);
    const m = res.cards.find(c => c.card === 'Massacre')!; const a = res.cards.find(c => c.card === 'Argh... Smash!')!;
    expect(m.pitch).toBe(1);
    expect(a.pitch).toBeNull();
    expect(a.pitchOptions).toEqual([1, 2, 3]);
  });

  it('lists results in reading order (top row first, left to right)', async () => {
    const res = await scanPhoto(img, index, async () => 'Massacre');
    for (let i = 1; i < res.cards.length; i++) {
      const a = res.cards[i - 1].rect, b = res.cards[i].rect;
      const sameRow = Math.abs(a.cy - b.cy) < Math.min(a.h, b.h) * 4;
      expect(sameRow ? a.cx <= b.cx : a.cy < b.cy).toBe(true);
    }
  });
});
