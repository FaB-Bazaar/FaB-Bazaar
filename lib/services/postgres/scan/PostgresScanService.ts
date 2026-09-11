// lib/services/postgres/scan/PostgresScanService.ts
// Card scanner backend: stores perceptual hashes per printing image and
// identifies a photographed card by Hamming distance over the whole index.
//
// The index (~17k rows, two 64-bit hashes each) is loaded into memory once
// and refreshed on a TTL — brute-force ranking is a few ms. Results are
// grouped by card NAME, because pitch siblings share artwork (identical
// hashes) and foilings/editions share the render; the user picks the exact
// printing in the UI. See lib/scan/ for the hash math.

import { db } from '@/lib/postgres/db';
import { cards, printings, printingImageHashes } from '@/lib/postgres/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import type { AsyncResult } from '../../contracts/common';
import { rankByDistance, MAX_DISTANCE, type HashPair, type HashIndexEntry } from '@/lib/scan/phash';
import type { PitchHint } from '@/lib/scan/image-hash';

export interface HashIndexRow extends HashIndexEntry {
  printingId: string;
  cardUniqueId: string;
}

export interface ScanPrinting {
  printingId: string;
  collectorNumber: string | null;
  set: string;
  edition: string;
  foiling: string;
  language: string;
  rarity: string;
  artVariations: string[] | null;
  imageUrl: string | null;
  tcgLow: number | null;
  /** Combined Hamming distance for this printing's own render; null = this printing's image was not hashed (or not close). */
  distance: number | null;
}

export interface ScanCardCandidate {
  cardUniqueId: string;
  name: string;
  pitch: number | null;
  distance: number;
  printings: ScanPrinting[];
}

export interface ScanCandidate {
  name: string;
  distance: number;
  cards: ScanCardCandidate[];
}

export interface IdentifyResult {
  candidates: ScanCandidate[];
  /** Combined Hamming distance (0..256: 2×art + phash + dhash) of the best match. */
  bestDistance: number | null;
  indexSize: number;
}

const INDEX_TTL_MS = 10 * 60 * 1000;
/** How many raw printing rows to rank before grouping; siblings collapse heavily. */
const RAW_RANK_LIMIT = 60;

const PITCH_ORDER: Record<PitchHint, number> = { red: 1, yellow: 2, blue: 3 };

/** Pitch-hint ordering: the hinted pitch first, then natural pitch order. Stable on ties. */
export function orderCardsByPitchHint<T extends { pitch: number | null; distance: number }>(cardsIn: T[], hint: PitchHint | null): T[] {
  const hinted = hint ? PITCH_ORDER[hint] : null;
  return [...cardsIn].sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    const ah = hinted !== null && a.pitch === hinted ? 0 : 1;
    const bh = hinted !== null && b.pitch === hinted ? 0 : 1;
    if (ah !== bh) return ah - bh;
    return (a.pitch ?? 99) - (b.pitch ?? 99);
  });
}

export class PostgresScanService {
  private index: { rows: HashIndexRow[]; loadedAt: number } | null = null;
  private loading: Promise<HashIndexRow[]> | null = null;

  clearIndexCache(): void {
    this.index = null;
    this.loading = null;
  }

  async upsertHashes(rows: Array<{ printingId: string; phash: string; dhash?: string | null; artHash?: string | null; imageUrl: string }>): AsyncResult<{ upserted: number }> {
    try {
      if (rows.length === 0) return { success: true, data: { upserted: 0 } };
      await db.insert(printingImageHashes)
        .values(rows.map(r => ({ printingId: r.printingId, phash: r.phash, dhash: r.dhash ?? null, artPhash: r.artHash ?? null, imageUrl: r.imageUrl })))
        .onConflictDoUpdate({
          target: printingImageHashes.printingId,
          set: {
            phash: sql`excluded.phash`,
            dhash: sql`excluded.dhash`,
            artPhash: sql`excluded.art_phash`,
            imageUrl: sql`excluded.image_url`,
            computedAt: sql`now()`,
          },
        });
      return { success: true, data: { upserted: rows.length } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to upsert hashes' };
    }
  }

  /** Which of these printing ids exist (the hash table has an FK to printings). */
  async filterKnownPrintingIds(ids: string[]): AsyncResult<Set<string>> {
    try {
      if (ids.length === 0) return { success: true, data: new Set() };
      const rows = await db.select({ id: printings.printingId }).from(printings).where(inArray(printings.printingId, ids));
      return { success: true, data: new Set(rows.map(r => r.id)) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to look up printings' };
    }
  }

  /** Index size — the no-SSH probe for "is the table there and populated on prod?". */
  async countHashes(): AsyncResult<{ total: number; withArt: number; latestComputedAt: string | null }> {
    try {
      const [row] = await db
        .select({
          total: sql<number>`count(*)::int`,
          withArt: sql<number>`count(${printingImageHashes.artPhash})::int`,
          latest: sql<Date | null>`max(${printingImageHashes.computedAt})`,
        })
        .from(printingImageHashes);
      const latest = row?.latest ? new Date(row.latest as unknown as string) : null;
      return { success: true, data: { total: row?.total ?? 0, withArt: row?.withArt ?? 0, latestComputedAt: latest ? latest.toISOString() : null } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to count hashes' };
    }
  }

  /** Printing ids already hashed, with the image_url that was hashed (for skip-unchanged). */
  async listHashedImageUrls(): AsyncResult<Map<string, string>> {
    try {
      const rows = await db.select({ printingId: printingImageHashes.printingId, imageUrl: printingImageHashes.imageUrl }).from(printingImageHashes);
      return { success: true, data: new Map(rows.map(r => [r.printingId, r.imageUrl])) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list hashes' };
    }
  }

  async listHashIndex(): AsyncResult<HashIndexRow[]> {
    try {
      const rows = await db
        .select({
          printingId: printingImageHashes.printingId,
          cardUniqueId: printings.cardUniqueId,
          phash: printingImageHashes.phash,
          dhash: printingImageHashes.dhash,
          artPhash: printingImageHashes.artPhash,
        })
        .from(printingImageHashes)
        .innerJoin(printings, eq(printings.printingId, printingImageHashes.printingId));
      return { success: true, data: rows.map(r => ({ id: r.printingId, printingId: r.printingId, cardUniqueId: r.cardUniqueId, phash: r.phash.trim(), dhash: r.dhash?.trim() ?? null, artHash: r.artPhash?.trim() ?? null })) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to load hash index' };
    }
  }

  private async getIndex(): Promise<HashIndexRow[]> {
    if (this.index && Date.now() - this.index.loadedAt < INDEX_TTL_MS) return this.index.rows;
    if (!this.loading) {
      this.loading = (async () => {
        const res = await this.listHashIndex();
        if (!res.success) throw new Error(res.error);
        this.index = { rows: res.data, loadedAt: Date.now() };
        this.loading = null;
        return res.data;
      })().catch(err => { this.loading = null; throw err; });
    }
    return this.loading;
  }

  async identify(query: HashPair, opts: { limit?: number; pitchHint?: PitchHint | null } = {}): AsyncResult<IdentifyResult> {
    try {
      const limit = Math.max(1, Math.min(opts.limit ?? 5, 20));
      const index = await this.getIndex();
      if (index.length === 0) return { success: true, data: { candidates: [], bestDistance: null, indexSize: 0 } };

      const ranked = rankByDistance(query, index, RAW_RANK_LIMIT);
      const byPrinting = new Map(index.map(r => [r.printingId, r]));
      const distanceByPrinting = new Map(ranked.map(r => [r.id, r.distance]));
      const cardIds = [...new Set(ranked.map(r => byPrinting.get(r.id)!.cardUniqueId))];

      const rows = await db
        .select({
          printingId: printings.printingId,
          cardUniqueId: printings.cardUniqueId,
          name: cards.displayName,
          pitch: cards.pitch,
          collectorNumber: printings.collectorNumber,
          set: printings.set,
          edition: printings.edition,
          foiling: printings.foiling,
          language: printings.language,
          rarity: printings.rarity,
          artVariations: printings.artVariations,
          imageUrl: printings.imageUrl,
          tcgLow: printings.tcgLow,
        })
        .from(printings)
        .innerJoin(cards, eq(cards.cardUniqueId, printings.cardUniqueId))
        .where(inArray(printings.cardUniqueId, cardIds));

      // card_unique_id → card candidate (all its printings, matched or not)
      const cardMap = new Map<string, ScanCardCandidate>();
      for (const r of rows) {
        let c = cardMap.get(r.cardUniqueId);
        if (!c) {
          c = { cardUniqueId: r.cardUniqueId, name: r.name, pitch: r.pitch, distance: Infinity, printings: [] };
          cardMap.set(r.cardUniqueId, c);
        }
        const d = distanceByPrinting.get(r.printingId) ?? null;
        c.printings.push({
          printingId: r.printingId, collectorNumber: r.collectorNumber, set: r.set, edition: r.edition,
          foiling: r.foiling, language: r.language, rarity: r.rarity, artVariations: r.artVariations,
          imageUrl: r.imageUrl, tcgLow: r.tcgLow, distance: d,
        });
        if (d !== null && d < c.distance) c.distance = d;
      }
      for (const c of cardMap.values()) {
        c.printings.sort((a, b) =>
          (a.distance ?? 999) - (b.distance ?? 999)
          || (a.language === 'en' ? 0 : 1) - (b.language === 'en' ? 0 : 1)
          || (a.collectorNumber ?? '').localeCompare(b.collectorNumber ?? ''));
      }

      // group by name (pitch siblings), best distance first
      const byName = new Map<string, ScanCandidate>();
      for (const c of cardMap.values()) {
        let g = byName.get(c.name);
        if (!g) { g = { name: c.name, distance: c.distance, cards: [] }; byName.set(c.name, g); }
        g.cards.push(c);
        if (c.distance < g.distance) g.distance = c.distance;
      }
      const candidates = [...byName.values()]
        .map(g => ({ ...g, cards: orderCardsByPitchHint(g.cards, opts.pitchHint ?? null) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit)
        .map(g => ({ ...g, distance: Number.isFinite(g.distance) ? g.distance : MAX_DISTANCE }));

      return { success: true, data: { candidates, bestDistance: candidates[0]?.distance ?? null, indexSize: index.length } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to identify card' };
    }
  }
}
