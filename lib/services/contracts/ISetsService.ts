// lib/services/contracts/ISetsService.ts
//
// Set metadata reference data (the `sets` table — source of truth for set
// names, release dates/order, category/tier, core-set status; migration 0061).

import type { AsyncResult } from './common';

export interface SetDTO {
  /** Lowercase set code, matches printings.set (e.g. 'wtr') */
  code: string;
  /** Display form of the code (e.g. 'WTR') */
  displayCode: string;
  name: string;
  /** YYYY-MM-DD of the first product release; null = unannounced */
  releaseDate: string | null;
  /** Global chronological ordering (spaced by 10 for future inserts) */
  releaseOrder: number;
  /**
   * Curated printing-display ranking (lower = earlier; spaced by 10). Drives
   * the set-level step of sortPrintings — UPDATE the row to re-order, then
   * regenerate the constants snapshot.
   */
  displayOrder: number;
  category: 'standard' | 'armory' | 'non-standard' | 'excluded';
  /** Printing display tier: 1 main … 5 promo (display order 1→2→5→3→4) */
  tier: number;
  /** Main booster set ("core" set) */
  isCore: boolean;
  hasFirstEdition: boolean;
  /** WTR/ARC/CRU/MON: unlimited is the accessible printing, list it first */
  unlimitedBeforeFirst: boolean;
  defaultRarity: string | null;
  /** Cloudflare image id for the set logo */
  imageId: string | null;
}

export interface ISetsService {
  /** All sets ordered by releaseOrder ascending. */
  listSets(): AsyncResult<SetDTO[]>;
  /** One set by code (case-insensitive). null when unknown. */
  getSetByCode(code: string): AsyncResult<SetDTO | null>;
  /**
   * Transactionally renumber display_order for the given sets. All codes must
   * exist and target orders must be unique positive integers; on any failure
   * nothing is changed. Remember to regenerate the constants snapshot after.
   */
  reorderSets(orders: Array<{ code: string; displayOrder: number }>): AsyncResult<{ updated: number }>;
}
