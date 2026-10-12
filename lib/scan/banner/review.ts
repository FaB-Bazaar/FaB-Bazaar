// lib/scan/banner/review.ts — pure helper for the /scan review list: where the whole card sits around a found name
// banner (for the "your photo" crop).
import type { BannerRect } from './find-banners';

// Card layout, measured on the Sink Below render (300x419): the name banner is ~62% of the card's width and its centre
// sits ~8.6% of the card's height below the top edge. A card is 63x88 mm.
const BANNER_WIDTH_FRACTION = 0.62;
const BANNER_CENTRE_FROM_TOP = 0.086;
const CARD_ASPECT = 88 / 63;

/** Rough outline of the whole card around its name banner (same tilt). Good enough for a thumbnail, not geometry. */
export function cardRegionFromBanner(b: BannerRect): BannerRect {
  const w = b.w / BANNER_WIDTH_FRACTION, h = w * CARD_ASPECT;
  const a = (b.angle * Math.PI) / 180;
  const downX = -Math.sin(a), downY = Math.cos(a);              // perpendicular to the banner, towards the card body
  const shift = (0.5 - BANNER_CENTRE_FROM_TOP) * h;
  return { cx: b.cx + downX * shift, cy: b.cy + downY * shift, w, h, angle: b.angle };
}
