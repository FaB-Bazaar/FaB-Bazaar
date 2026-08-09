export interface PrintingRow {
  printingId: string;
  name: string;
  set: string;
  edition: string;
  foiling: string;
  rarity: string;
  collectorNumber: string | null;
  imageUrl: string | null;
  pitch: number | null;
  isExtendedArt: boolean;
  artVariations: string[] | null;
  foilInsetTop: number | null;
  foilInsetRight: number | null;
  foilInsetBottom: number | null;
  foilInsetLeft: number | null;
  foilInsetRound: string | null;
  foilInsetLocked: boolean;
  tcgplayerProductId: string | null;
  tcgplayerUrl: string | null;
  tcgplayerSubtypeName: string | null;
}

export interface FoilMaskValues {
  top: number;
  right: number;
  bottom: number;
  left: number;
  round: string;
}

export interface FoilMaskTemplate extends FoilMaskValues {
  id: string;
  name: string;
  notes: string | null;
  sortOrder: number;
}

/** A dry-run result: what a criteria sweep would do, before it does it. */
export interface FoilMaskPreview {
  wouldUpdate: number;
  skippedLocked: number;
  skippedAlreadySet: number;
  setCount: number;
  sample: Array<{ printingId: string; name: string; set: string; imageUrl: string | null }>;
}

export interface FoilMaskBulkOp extends FoilMaskValues {
  id: string;
  kind: string;
  description: string;
  affectedCount: number;
  undoneAt: string | null;
  createdAt: string;
}

export const DEFAULT_MASK: FoilMaskValues = { top: 12.5, right: 9.5, bottom: 41.5, left: 9.5, round: '1.5%' };
export const CF_BASE_URL = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg';

/** Prefer the row's real image_url — reconstructing from printing_id 404s for
 *  every deterministic-id row, which is most of the catalogue now. */
export function printingImageSrc(row: Pick<PrintingRow, 'imageUrl' | 'printingId'>): string {
  return row.imageUrl ?? `${CF_BASE_URL}/${row.printingId}/public`;
}

export function maskClipPath(mask: FoilMaskValues): string {
  return `inset(${mask.top}% ${mask.right}% ${mask.bottom}% ${mask.left}% round ${mask.round})`;
}
