import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { cards, cardvaultPayloadCache, printings, sets } from '@/lib/postgres/schema';
import type { ExistingCardRow, ExistingPrintingRow, SetIngestPlan } from '@/lib/import/plan-set-ingest';
import type { IngestRow } from '@/lib/images/ingest-image-ids';
import { cardProps, convertRow, printingProps } from '../ingest/PostgresIngestService';
import type { AsyncResult } from '../../contracts/common';

/**
 * DB half of the /admin/cardvault ingest job (lib/import/cardvault-job.ts):
 * the CardVault payload cache (migration 0122), the planner's DB context, the
 * plan commit, and image-upload bookkeeping. Same writes as
 * scripts/import-new-set.ts — INSERT/UPDATE only, never DELETE.
 */

export interface IngestSet { code: string; name: string; hasFirstEdition: boolean }

export interface IngestSetSummary {
  code: string;
  displayCode: string;
  name: string;
  releaseDate: string | null;
  enPrintings: number;
  collectorNumbers: number;
  /** Image status counts every language — the upload step does too. */
  printings: number;
  imagesNotOnCloudflare: number;
  imagesMissing: number;
}

export interface CommitPlanResult {
  cardsCreated: number;
  cardsEnriched: number;
  printingsCreated: number;
  retroLinksSet: number;
}

export interface ImageRow {
  printingId: string;
  collectorNumber: string | null;
  foiling: string | null;
  edition: string | null;
  isFrontFace: boolean | null;
  imageUrl: string | null;
}

const fail = (e: unknown, what: string) =>
  ({ success: false as const, error: e instanceof Error ? e.message : `${what} failed` });

// The image-id planner's row shape (snake_case, as the CLI selects it).
const IMAGE_KEY_COLS = sql`printing_id, image_url, lss_print_code, language, collector_number,
  foiling, edition, is_extended_art, is_front_face, art_variations`;

export class PostgresCardVaultService {
  async getSet(code: string): AsyncResult<IngestSet | null> {
    try {
      const [row] = await db.select({ code: sets.code, name: sets.name, hasFirstEdition: sets.hasFirstEdition })
        .from(sets).where(eq(sets.code, code.toLowerCase()));
      return { success: true, data: row ?? null };
    } catch (e) { return fail(e, 'getSet'); }
  }

  /** Every registered set, newest first, with its English coverage + image status. */
  async listSets(): AsyncResult<IngestSetSummary[]> {
    try {
      const rows = await db.execute(sql`
        SELECT s.code, s.display_code, s.name, s.release_date::text AS release_date,
               count(p.printing_id) FILTER (WHERE p.language = 'en')::int AS en_printings,
               count(DISTINCT p.collector_number) FILTER (WHERE p.language = 'en')::int AS collector_numbers,
               count(p.printing_id)::int AS printings,
               count(p.printing_id) FILTER (WHERE p.image_url NOT LIKE '%imagedelivery%')::int AS images_not_on_cloudflare,
               count(p.printing_id) FILTER (WHERE p.image_url IS NULL)::int AS images_missing
          FROM sets s
          LEFT JOIN printings p ON p.set = s.code
         WHERE s.category <> 'excluded'
         GROUP BY s.code
         ORDER BY s.release_date DESC NULLS FIRST, s.release_order DESC`);
      return {
        success: true,
        data: (rows.rows as any[]).map((r) => ({
          code: r.code, displayCode: r.display_code, name: r.name, releaseDate: r.release_date,
          enPrintings: r.en_printings, collectorNumbers: r.collector_numbers, printings: r.printings,
          imagesNotOnCloudflare: r.images_not_on_cloudflare, imagesMissing: r.images_missing,
        })),
      };
    } catch (e) { return fail(e, 'listSets'); }
  }

  async getCachedPayloads(slugs: string[]): AsyncResult<Record<string, unknown>> {
    try {
      if (!slugs.length) return { success: true, data: {} };
      const rows = await db.select().from(cardvaultPayloadCache).where(inArray(cardvaultPayloadCache.slug, slugs));
      return { success: true, data: Object.fromEntries(rows.map((r) => [r.slug, r.payload])) };
    } catch (e) { return fail(e, 'getCachedPayloads'); }
  }

  async savePayload(slug: string, payload: unknown): AsyncResult<void> {
    try {
      await db.insert(cardvaultPayloadCache).values({ slug, payload })
        .onConflictDoUpdate({ target: cardvaultPayloadCache.slug, set: { payload, fetchedAt: new Date() } });
      return { success: true, data: undefined };
    } catch (e) { return fail(e, 'savePayload'); }
  }

  /** The rows planSetIngest() needs: the set's printings + candidate cards. */
  async loadPlanContext(
    set: string,
    keys: { lssCardIds: string[]; talisharIds: string[] },
  ): AsyncResult<{ existingPrintings: ExistingPrintingRow[]; cardRows: ExistingCardRow[] }> {
    try {
      const existing = await db.execute(sql`
        SELECT printing_id, lss_print_id, other_face_printing_id, set, collector_number, edition, foiling, language
          FROM printings WHERE set = ${set.toLowerCase()}`);
      const lss = keys.lssCardIds.length ? keys.lssCardIds : [''];
      const tal = keys.talisharIds.length ? keys.talisharIds : [''];
      const cardRows = await db.execute(sql`
        SELECT card_unique_id, lss_card_id, talishar_card_id, fab_cube_card_id FROM cards
         WHERE lss_card_id IN ${lss} OR talishar_card_id IN ${tal}`);
      return {
        success: true,
        data: { existingPrintings: existing.rows as any, cardRows: cardRows.rows as any },
      };
    } catch (e) { return fail(e, 'loadPlanContext'); }
  }

  /** Apply a plan in one transaction (the CLI's step 5). */
  async commitPlan(plan: SetIngestPlan): AsyncResult<CommitPlanResult> {
    try {
      const result: CommitPlanResult = { cardsCreated: 0, cardsEnriched: 0, printingsCreated: 0, retroLinksSet: 0 };
      await db.transaction(async (tx) => {
        const keepIds = new Set(['card_unique_id']);
        const toCard = (c: Record<string, unknown>) =>
          convertRow(c, cardProps, new Set(['created_at', 'updated_at']), 'cards');
        if (plan.newCards.length) {
          await tx.insert(cards).values(plan.newCards.map((c) => toCard(c)) as any);
          result.cardsCreated = plan.newCards.length;
        }
        for (const c of plan.enrichCards) {
          const values = toCard(Object.fromEntries(Object.entries(c).filter(([k]) => !keepIds.has(k))));
          // fab-cube-anchored cards are never touched — fab-cube owns their fields.
          const updated = await tx.update(cards).set(values as any)
            .where(and(eq(cards.cardUniqueId, c.card_unique_id), isNull(cards.fabCubeCardId)))
            .returning({ id: cards.cardUniqueId });
          result.cardsEnriched += updated.length;
        }
        if (plan.newPrintings.length) {
          // Insert unlinked, then link: a pair's rows reference each other.
          const rows = plan.newPrintings.map((p) => ({
            ...convertRow({ ...p, other_face_printing_id: null }, printingProps, new Set(), 'printings'),
          }));
          await tx.insert(printings).values(rows as any);
          for (const p of plan.newPrintings) {
            if (!p.other_face_printing_id) continue;
            await tx.update(printings).set({ otherFacePrintingId: p.other_face_printing_id })
              .where(eq(printings.printingId, p.printing_id));
          }
          result.printingsCreated = plan.newPrintings.length;
        }
        for (const l of plan.retroLinks) {
          const updated = await tx.update(printings).set({ otherFacePrintingId: l.backId })
            .where(and(eq(printings.printingId, l.frontId), isNull(printings.otherFacePrintingId)))
            .returning({ id: printings.printingId });
          result.retroLinksSet += updated.length;
        }
      });
      return { success: true, data: result };
    } catch (e) { return fail(e, 'commitPlan'); }
  }

  /**
   * Printings in the set whose image is not on Cloudflare yet (resumable: a
   * partial upload pass heals on re-run), plus the collision universe — every
   * row sharing a pending collector number, which owns its key already.
   */
  async listPendingImageRows(set: string): AsyncResult<{ pending: IngestRow[]; universe: IngestRow[] }> {
    try {
      const pending = await db.execute(sql`
        SELECT ${IMAGE_KEY_COLS} FROM printings
         WHERE set = ${set.toLowerCase()} AND image_url IS NOT NULL AND image_url NOT LIKE '%imagedelivery%'`);
      const collectors = [...new Set((pending.rows as any[]).map((r) => r.collector_number))];
      const universe = collectors.length
        ? await db.execute(sql`SELECT ${IMAGE_KEY_COLS} FROM printings WHERE collector_number IN ${collectors}`)
        : { rows: [] };
      return { success: true, data: { pending: pending.rows as any, universe: universe.rows as any } };
    } catch (e) { return fail(e, 'listPendingImageRows'); }
  }

  async setImageUrl(printingId: string, imageUrl: string): AsyncResult<void> {
    try {
      await db.update(printings).set({ imageUrl }).where(eq(printings.printingId, printingId));
      return { success: true, data: undefined };
    } catch (e) { return fail(e, 'setImageUrl'); }
  }

  /** Every printing's image_url in the set, for the image health probe. */
  async listImageRows(set: string): AsyncResult<ImageRow[]> {
    try {
      const rows = await db.select({
        printingId: printings.printingId, collectorNumber: printings.collectorNumber,
        foiling: printings.foiling, edition: printings.edition,
        isFrontFace: printings.isFrontFace, imageUrl: printings.imageUrl,
      }).from(printings).where(eq(printings.set, set.toLowerCase()));
      return { success: true, data: rows };
    } catch (e) { return fail(e, 'listImageRows'); }
  }
}
