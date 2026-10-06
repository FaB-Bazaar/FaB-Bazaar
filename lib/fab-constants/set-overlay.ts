// lib/fab-constants/set-overlay.ts
//
// Runtime set registry. The `sets` table is the source of truth, but the app
// reads sets synchronously from a compiled snapshot (sets-data.generated.ts,
// CARD_FILTER_SETS, SET_IMAGES) — a set registered from /admin/cardvault
// would be invisible until a developer regenerated it and deployed.
//
// The overlay is the DIFFERENCE between the DB and that snapshot (new sets,
// changed metadata, logos from sets.image_id, filter-chip membership from
// sets.in_card_filters). Publishing it makes every module copy of sets.ts patch
// its constants in place (syncSetOverlay), so existing consumers
// (getSetMetadata, CARD_FILTER_SETS, getSetImageUrl, SET_FILTER_GROUPS, …) see
// it unchanged. Normally empty, so it costs nothing in page payloads.
//
// Server: set-overlay-server.ts loads it from the DB (instrumentation.ts at
// boot + every minute + right after a set is registered). Browser:
// components/providers/SetOverlayProvider publishes the layout's copy before
// rendering children.
import {
  compiledSetSnapshot, syncSetOverlay, appliedSetOverlayVersion, SET_OVERLAY_GLOBAL,
  type SetMetadata, type SetOverlay,
} from './sets';

export type { SetOverlay };
export { appliedSetOverlayVersion };

/** A `sets` row as the overlay needs it (SetDTO + in_card_filters). */
export interface SetRow {
  code: string;
  displayCode: string;
  name: string;
  releaseDate: string | null;
  releaseOrder: number;
  displayOrder: number;
  category: SetMetadata['category'];
  tier: number;
  hasFirstEdition: boolean;
  unlimitedBeforeFirst: boolean;
  defaultRarity: string | null;
  imageId: string | null;
  /** NULL = follow the compiled CARD_FILTER_SETS; true/false = DB decides. */
  inCardFilters: boolean | null;
}

/** Same mapping as scripts/generate-set-constants.ts. */
export function rowToSetMetadata(r: SetRow): SetMetadata {
  const m: SetMetadata = {
    code: r.displayCode,
    name: r.name,
    releaseDate: r.releaseDate ?? '',
    hasFirstEdition: r.hasFirstEdition,
    category: r.category,
    tier: r.tier as SetMetadata['tier'],
    displayOrder: r.displayOrder,
    unlimitedBeforeFirst: r.unlimitedBeforeFirst,
  };
  if (r.defaultRarity) m.defaultRarity = r.defaultRarity;
  return m;
}

const canonical = (m: SetMetadata) =>
  JSON.stringify(Object.keys(m).sort().map((k) => [k, (m as unknown as Record<string, unknown>)[k]]));

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `v${(h >>> 0).toString(36)}`;
}

function finish(o: Omit<SetOverlay, 'version'>): SetOverlay {
  return { ...o, version: hash(JSON.stringify([o.meta, o.images, o.filterSets])) };
}

export const EMPTY_SET_OVERLAY: SetOverlay = finish({ meta: {}, images: {}, filterSets: null });

export function buildSetOverlay(rows: SetRow[]): SetOverlay {
  const compiled = compiledSetSnapshot();
  const meta: Record<string, SetMetadata> = {};
  const images: Record<string, string> = {};
  for (const r of rows) {
    const code = r.code.toLowerCase();
    const m = rowToSetMetadata(r);
    const known = compiled.meta[code];
    if (!known || canonical(known) !== canonical(m)) meta[code] = m;
    if (r.imageId && r.imageId !== compiled.images[code]) images[code] = r.imageId;
  }

  const byCode = new Map(rows.map((r) => [r.code.toLowerCase(), r]));
  const kept = compiled.filters.filter((c) => byCode.get(c)?.inCardFilters !== false);
  // Undated (announced, no date yet) sorts as newest.
  const added = rows
    .filter((r) => r.inCardFilters === true && !compiled.filters.includes(r.code.toLowerCase()))
    .sort((a, b) => (b.releaseDate || '9999').localeCompare(a.releaseDate || '9999'))
    .map((r) => r.code.toLowerCase());
  const filterSets = added.length || kept.length !== compiled.filters.length ? [...added, ...kept] : null;

  return finish({ meta, images, filterSets });
}

/** The overlay published in this process / browser tab. */
export function currentSetOverlay(): SetOverlay {
  return ((globalThis as Record<string, unknown>)[SET_OVERLAY_GLOBAL] as SetOverlay | undefined) ?? EMPTY_SET_OVERLAY;
}

/** Publish an overlay (replacing any previous one) and patch this module copy. Idempotent. */
export function applySetOverlay(o: SetOverlay): void {
  (globalThis as Record<string, unknown>)[SET_OVERLAY_GLOBAL] = o;
  syncSetOverlay();
}

/** Back to the compiled snapshot (tests). */
export function resetSetOverlay(): void {
  delete (globalThis as Record<string, unknown>)[SET_OVERLAY_GLOBAL];
  syncSetOverlay();
}
