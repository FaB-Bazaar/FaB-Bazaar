// Banner finder on a real sleeved 9-pocket binder page (IMG_5940, cropped to the page, 1500px wide).
import { describe, it, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import path from 'node:path';
import { findBanners, cutBanner, cutRegion, type RgbImage, type BannerRect } from './find-banners';
import { cardRegionFromBanner } from './review';

const FIXTURE = path.join(__dirname, '..', '__fixtures__', 'binder-page-9.jpg');
// centre of each card's NAME banner in the fixture, read off the image (Dig Up Dinner / Massacre / Argh... Smash!)
const NAMES: Array<[string, number, number]> = [
  ['Dig Up Dinner', 258, 172], ['Dig Up Dinner', 669, 153], ['Dig Up Dinner', 1074, 124],
  ['Massacre', 237, 638], ['Massacre', 680, 635], ['Massacre', 1100, 627],
  ['Argh... Smash!', 213, 1215], ['Argh... Smash!', 673, 1190], ['Argh... Smash!', 1149, 1199],
];

let img: RgbImage;
let found: BannerRect[];
beforeAll(async () => {
  const { data, info } = await sharp(FIXTURE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  img = { data, width: info.width, height: info.height, channels: 3 };
  found = findBanners(img);
}, 60_000);   // decodes + searches a real photo: slow when the whole suite runs in parallel

describe('findBanners', () => {
  it.each(NAMES.map((n, i) => [i, ...n] as const))('finds the name banner of card %i (%s)', (_i, _name, x, y) => {
    const hit = found.find(b => Math.hypot(b.cx - x, b.cy - y) < 60);
    expect(hit, `no banner near (${x}, ${y}); found ${found.length}`).toBeDefined();
    expect(Math.abs(hit!.angle)).toBeLessThan(10);
    expect(hit!.w).toBeGreaterThan(200);
    expect(hit!.w).toBeLessThan(420);
  });

  it('does not report the same banner twice', () => {
    for (const [, x, y] of NAMES) expect(found.filter(b => Math.hypot(b.cx - x, b.cy - y) < 60).length).toBe(1);
  });
});

describe('cutBanner', () => {
  it('returns a straightened crop about the size of the banner', () => {
    const hit = found.find(b => Math.hypot(b.cx - NAMES[4][1], b.cy - NAMES[4][2]) < 60)!;
    const crop = cutBanner(img, hit);
    expect(crop.width).toBeGreaterThan(hit.w * 0.95);
    expect(crop.width).toBeLessThan(hit.w * 1.15);
    expect(crop.height).toBeGreaterThan(hit.h);
    expect(crop.data.length).toBe(crop.width * crop.height * 3);
  });
});

describe('cutRegion', () => {
  it('cuts a straightened, card-shaped thumbnail of the card around a banner', () => {
    const hit = found.find(b => Math.hypot(b.cx - NAMES[4][1], b.cy - NAMES[4][2]) < 60)!;
    const thumb = cutRegion(img, cardRegionFromBanner(hit), 120);
    expect(thumb.width).toBe(120);
    expect(thumb.height / thumb.width).toBeCloseTo(88 / 63, 1);
    expect(thumb.data.length).toBe(thumb.width * thumb.height * 3);
  });
});
