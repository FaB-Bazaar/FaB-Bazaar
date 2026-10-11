// Targeted read where the user tapped a card the scan missed (scan-tap-eval on the labelled binder pages: a tap
// recovered 43 of 56 missed cards, 0 wrong). OCR is faked here; real-OCR accuracy is what scripts/scan-tap-eval.ts measures.
import { describe, it, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import path from 'node:path';
import { readAtPoint, estimateCardWidth } from './read-at-point';
import { findBanners, type RgbImage } from './find-banners';
import { buildNameIndex } from './name-match';
import { cardRegionFromBanner } from './review';

const FIXTURE = path.join(__dirname, '..', '__fixtures__', 'binder-page-9.jpg');
const index = buildNameIndex([{ name: 'Massacre', pitches: [1] }, { name: 'Dig Up Dinner', pitches: [3] }]);
let img: RgbImage;
beforeAll(async () => {
  const { data, info } = await sharp(FIXTURE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  img = { data, width: info.width, height: info.height, channels: 3 };
});

describe('estimateCardWidth', { timeout: 30_000 }, () => {   // decodes a real photo: slow when the whole suite runs in parallel
  it('derives the card width from the name banners already found (banner ~62% of the card)', () => {
    expect(estimateCardWidth([248, 260, 255], 3000)).toBeCloseTo(255 / 0.62, 0);
  });
  it('falls back to about a third of the photo width (a binder page) when nothing was found', () => {
    expect(estimateCardWidth([], 1500)).toBeCloseTo(1500 / 3.3, 0);
  });
});

describe('readAtPoint', { timeout: 30_000 }, () => {   // decodes a real photo: slow when the whole suite runs in parallel
  it('reads the card under a tap and returns its banner in photo coordinates', async () => {
    const banner = findBanners(img).find(b => Math.hypot(b.cx - 680, b.cy - 635) < 60)!;   // middle Massacre
    const card = cardRegionFromBanner(banner);
    const res = await readAtPoint(img, { x: card.cx, y: card.cy }, card.w, index, async () => 'Massacre');
    expect(res).not.toBeNull();
    expect(res!.card).toMatchObject({ card: 'Massacre', accepted: true, pitch: 1 });
    expect(Math.hypot(res!.card.rect.cx - banner.cx, res!.card.rect.cy - banner.cy)).toBeLessThan(40);
  });

  it('also reads the card when the tap lands on its name banner, not the middle of the card', async () => {
    const banner = findBanners(img).find(b => Math.hypot(b.cx - 680, b.cy - 635) < 60)!;   // middle Massacre
    const card = cardRegionFromBanner(banner);
    const res = await readAtPoint(img, { x: banner.cx, y: banner.cy }, card.w, index, async () => 'Massacre');
    expect(res?.card.card).toBe('Massacre');
    expect(Math.hypot(res!.card.rect.cx - banner.cx, res!.card.rect.cy - banner.cy)).toBeLessThan(40);
  });

  it('reads blind where the banner should be when no bar is found near the tap', async () => {
    const plain: RgbImage = { data: new Uint8Array(1200 * 1200 * 3).fill(128), width: 1200, height: 1200, channels: 3 };
    const res = await readAtPoint(plain, { x: 600, y: 600 }, 400, index, async () => 'Dig Up Dinner');
    expect(res?.how).toBe('blind');
    expect(res?.card.card).toBe('Dig Up Dinner');
    expect(res!.card.rect.cy).toBeLessThan(600 - 0.3 * 400 * (88 / 63));        // above the tap: the top of the card
  });

  it('returns nothing when no read is confident (the user types the name instead)', async () => {
    const res = await readAtPoint(img, { x: 680, y: 900 }, 420, index, async () => 'zzzz qqqq');
    expect(res).toBeNull();
  });
});
