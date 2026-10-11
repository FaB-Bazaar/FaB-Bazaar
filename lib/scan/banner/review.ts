// lib/scan/banner/review.ts — pure helpers for the /scan review list: where the whole card sits around a found name
// banner (for the "your photo" crop), and turning checked cards into staged bulk-import rows.
import type { BannerRect } from './find-banners';
import { bulkMergeKey, type BulkCardInstance } from '@/lib/browse/group-bulk-results';

// Card layout, measured on the Sink Below render (300x419): the name banner is ~62% of the card's width and its centre
// sits ~8.6% of the card's height below the top edge. A card is 63x88 mm.
const BANNER_WIDTH_FRACTION = 0.62;
const BANNER_CENTRE_FROM_TOP = 0.086;
const CARD_ASPECT = 88 / 63;

export interface ReviewPrintingRow { id: string; printing: any; allPrintings: any[] }

/** Rough outline of the whole card around its name banner (same tilt). Good enough for a thumbnail, not geometry. */
export function cardRegionFromBanner(b: BannerRect): BannerRect {
  const w = b.w / BANNER_WIDTH_FRACTION, h = w * CARD_ASPECT;
  const a = (b.angle * Math.PI) / 180;
  const downX = -Math.sin(a), downY = Math.cos(a);              // perpendicular to the banner, towards the card body
  const shift = (0.5 - BANNER_CENTRE_FROM_TOP) * h;
  return { cx: b.cx + downX * shift, cy: b.cy + downY * shift, w, h, angle: b.angle };
}

/** Checked review rows -> staged bulk-import rows: one per printing, quantity = how many copies have it. */
export function rowsToStagedInstances(rows: ReviewPrintingRow[]): BulkCardInstance[] {
  const byPrinting = new Map<string, BulkCardInstance>();
  for (const r of rows) {
    const key = r.printing.printing_id;
    const hit = byPrinting.get(key);
    if (hit) { hit.quantity++; continue; }
    byPrinting.set(key, {
      instanceId: `${r.printing.card_unique_id}-scan-${key}-${Date.now()}-${Math.random()}`,
      mergeKey: bulkMergeKey(r.printing.card_unique_id),
      card_unique_id: r.printing.card_unique_id,
      selectedPrinting: r.printing,
      quantity: 1,
      forTrade: false,
      allPrintings: r.allPrintings,
      isStaged: true,
    });
  }
  return [...byPrinting.values()];
}

/** Add staged rows to the bulk-import list; a printing that's already staged gets the quantity added (as /browse does). */
export function addStaged<T extends BulkCardInstance>(current: T[], incoming: T[]): T[] {
  let out = [...current];
  for (const inc of incoming) {
    const pid = inc.selectedPrinting?.printing_id;
    const target = out.find(c => c.isStaged && pid && c.selectedPrinting?.printing_id === pid);
    out = target ? out.map(c => (c === target ? { ...c, quantity: c.quantity + inc.quantity } : c)) : [...out, inc];
  }
  return out;
}
