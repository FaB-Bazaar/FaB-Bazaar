// lib/scan/banner/scan-photo.ts — banners -> OCR -> card names for one photo. The OCR engine is injected:
// tesseract.js in the browser (/scan/lab), anything in tests.
//
// Each banner is read with the cheapest preparation first and STOPS at the first confident name (the experiments
// read every banner four ways: ~4x the OCR + matching work). Upside-down reads only for sideways banners.
// Pitch comes from the NAME when the card exists in one pitch; otherwise it's left for the user (pitchOptions).
import { findBanners, cutBanner, type RgbImage, type BannerRect } from './find-banners';
import { matchName, type NameIndex } from './name-match';
import { prepStretched, prepTrimmedPadded, rotate180 } from './ocr-prep';

export interface ScannedCard {
  rect: BannerRect; card: string; score: number; accepted: boolean; runnerUp: string | null; text: string;
  /** Settled pitch (the name exists in one pitch), else null — ask the user among pitchOptions. */
  pitch: number | null; pitchOptions: Array<number | null>;
}
export interface ScanResult { cards: ScannedCard[]; timings: { banners: number; findMs: number; ocrMs: number; matchMs: number; reads: number } }

const SIDEWAYS = 55;   // degrees: find-banners reports sideways bars from here
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function readingOrder(cards: ScannedCard[]): ScannedCard[] {
  if (cards.length === 0) return cards;
  const hs = cards.map(c => c.rect.h).sort((a, b) => a - b), rowTol = hs[Math.floor(hs.length / 2)] * 4;
  const byY = [...cards].sort((a, b) => a.rect.cy - b.rect.cy), rows: ScannedCard[][] = [];
  for (const c of byY) { const row = rows[rows.length - 1]; if (row && Math.abs(c.rect.cy - row[0].rect.cy) < rowTol) row.push(c); else rows.push([c]); }
  return rows.flatMap(r => r.sort((a, b) => a.rect.cx - b.rect.cx));
}

export async function scanPhoto(img: RgbImage, index: NameIndex, ocr: (img: RgbImage) => Promise<string>): Promise<ScanResult> {
  let t = now(); const rects = findBanners(img); const findMs = now() - t;
  let ocrMs = 0, matchMs = 0, reads = 0; const cards: ScannedCard[] = [];
  for (const rect of rects) {
    const crop = cutBanner(img, rect);
    const preps = [() => prepStretched(crop), () => prepTrimmedPadded(crop)];
    // a sideways card's banner can come out upside down; an upright bar that didn't read is a type line / rules text,
    // and two more reads of it only cost time (4 reads per junk bar made a page take ~40 s)
    if (Math.abs(rect.angle) >= SIDEWAYS) preps.push(() => prepStretched(rotate180(crop)), () => prepTrimmedPadded(rotate180(crop)));
    const texts: string[] = []; let m = matchName(index, []);
    for (const prep of preps) {
      t = now(); texts.push(await ocr(prep())); ocrMs += now() - t; reads++;
      t = now(); m = matchName(index, texts); matchMs += now() - t;
      if (m.accepted) break;
    }
    const settled = m.accepted && m.pitches.length === 1 ? m.pitches[0] : null;
    cards.push({ rect, card: m.card, score: m.score, accepted: m.accepted, runnerUp: m.runnerUp, text: texts[texts.length - 1] ?? '', pitch: settled, pitchOptions: m.pitches });
  }
  return { cards: readingOrder(cards), timings: { banners: rects.length, findMs, ocrMs, matchMs, reads } };
}
