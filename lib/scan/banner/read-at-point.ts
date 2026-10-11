// lib/scan/banner/read-at-point.ts — targeted read of ONE card where the user tapped (a card the scan missed). Knowing
// a card is there lets the read try what the whole-photo scan can't afford: bars near the tap in a work image scaled to
// the card (light AND dark banners, via an inverted copy), then a blind read of where the banner should be — for a tap
// in the middle of the card or on its name. Measured with
// scripts/scan-tap-eval.ts on the labelled binder pages: a tap recovered 43 of 56 missed cards, 0 wrong.
import { findBanners, cutBanner, cutRegion, type RgbImage, type BannerRect } from './find-banners';
import { matchName, type NameIndex, type NameMatch } from './name-match';
import { prepStretched, prepTrimmedPadded } from './ocr-prep';
import type { ScannedCard } from './scan-photo';

const CARD_ASPECT = 88 / 63;
const BANNER_WIDTH_FRACTION = 0.62;        // name banner / card width
const BANNER_CENTRE_FROM_TOP = 0.086;      // name banner centre, as a fraction of card height from the top
const WORK_CARD_WIDTH = 420;               // the tapped card is scaled to this width (banner lands in findBanners' range)
const BLIND_OFFSETS = [0, -0.03, 0.03, -0.06, 0.06];   // fractions of card height: a sloppy tap

/** Card width from the name banners already found in the photo; about a third of the photo (binder page) if none. */
export function estimateCardWidth(bannerWidths: number[], imageWidth: number): number {
  if (bannerWidths.length === 0) return imageWidth / 3.3;
  const sorted = [...bannerWidths].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] / BANNER_WIDTH_FRACTION;
}

function invert(img: RgbImage): RgbImage {
  const data = new Uint8Array(img.width * img.height * 3);
  for (let i = 0, n = img.width * img.height; i < n; i++) for (let c = 0; c < 3; c++) data[i * 3 + c] = 255 - img.data[i * img.channels + c];
  return { data, width: img.width, height: img.height, channels: 3 };
}

export async function readAtPoint(
  img: RgbImage, tap: { x: number; y: number }, cardW: number, index: NameIndex, ocr: (img: RgbImage) => Promise<string>,
): Promise<{ card: ScannedCard; how: 'bar' | 'blind' } | null> {
  // the card's neighbourhood (1.3x the card), scaled so the card is WORK_CARD_WIDTH wide
  const k = WORK_CARD_WIDTH / cardW, cardH = cardW * CARD_ASPECT;
  const box: BannerRect = { cx: tap.x, cy: tap.y, w: cardW * 1.3, h: cardH * 1.3, angle: 0 };
  const work = cutRegion(img, box, Math.max(1, Math.round(box.w * k)));
  const wcx = work.width / 2, wcy = work.height / 2, cw = WORK_CARD_WIDTH, ch = cw * CARD_ASPECT;
  // where the name banner is if the user tapped the MIDDLE of the card, or tapped the NAME itself (the photo boxes mark
  // name banners, so both happen): candidates near either, closest first
  const expectedYs = [wcy - (0.5 - BANNER_CENTRE_FROM_TOP) * ch, wcy];
  const dist = (b: BannerRect) => Math.min(...expectedYs.map(y => Math.abs(b.cy - y)));
  const nearExpected = (b: BannerRect) => dist(b) < 0.2 * ch && Math.abs(b.cx - wcx) < 0.25 * cw && b.w > 0.35 * cw && b.w < 0.85 * cw;

  const read = async (r: BannerRect): Promise<{ m: NameMatch; text: string } | null> => {
    const crop = cutBanner(work, r), texts: string[] = [];
    for (const prep of [prepStretched, prepTrimmedPadded]) {
      texts.push(await ocr(prep(crop)));
      const m = matchName(index, texts);
      if (m.accepted) return { m, text: texts[texts.length - 1] };
    }
    return null;
  };
  const toPhoto = (r: BannerRect): BannerRect => ({ cx: tap.x + (r.cx - wcx) / k, cy: tap.y + (r.cy - wcy) / k, w: r.w / k, h: r.h / k, angle: r.angle });
  const result = (r: BannerRect, hit: { m: NameMatch; text: string }, how: 'bar' | 'blind') => ({
    how,
    card: { rect: toPhoto(r), card: hit.m.card, score: hit.m.score, accepted: true, runnerUp: hit.m.runnerUp, text: hit.text,
      pitch: hit.m.pitches.length === 1 ? hit.m.pitches[0] : null, pitchOptions: hit.m.pitches } satisfies ScannedCard,
  });

  // 1. bars near where this card's banner should be — light banners, then dark ones (Sink Below-style frames)
  const bars = [...findBanners(work).filter(nearExpected), ...findBanners(invert(work)).filter(nearExpected)].sort((a, b) => dist(a) - dist(b));
  for (const r of bars) {
    const hit = await read(r); if (hit) return result(r, hit, 'bar');
  }
  // 2. blind: read where the banner should be (middle-of-card tap first, then tap-on-the-name), at a few heights
  for (const y of expectedYs) for (const dy of BLIND_OFFSETS) {
    const r: BannerRect = { cx: wcx, cy: y + dy * ch, w: BANNER_WIDTH_FRACTION * cw, h: 0.05 * ch, angle: 0 };
    const hit = await read(r); if (hit) return result(r, hit, 'blind');
  }
  return null;
}
