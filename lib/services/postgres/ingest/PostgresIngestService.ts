import { nanoid } from 'nanoid';
import { and, eq, getTableColumns, inArray, isNull } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { cards, cardTranslations, printings } from '@/lib/postgres/schema';
import { naturalKeyOf } from '@/lib/import/cardvault-ingest';
import type { AsyncResult } from '../../contracts/common';

/**
 * Remote set ingest: upsert cards/printings/card_translations rows shipped
 * from another FaB Bazaar database (POST /api/admin/printings/ingest).
 *
 * Payload rows are snake_case column maps. Ids inside them are treated as
 * payload-local refs only; this DB resolves by natural identity and mints its
 * own nanoids for created rows (ids are minted per-database — see the
 * dual-source ID model in CLAUDE.md).
 */

export interface IngestSetRowsInput {
  set: string;
  cards: Array<Record<string, unknown>>;
  printings: Array<Record<string, unknown>>;
  translations?: Array<Record<string, unknown>>;
  dryRun?: boolean;
}

export interface IngestSetRowsResult {
  dryRun: boolean;
  cardsCreated: number;
  cardsEnriched: number;
  cardsMatched: number;
  printingsCreated: number;
  printingsSkipped: number;
  faceLinksSet: number;
  translationsUpserted: number;
}

// Server-managed columns a payload may carry but must never write directly:
// ids are minted here, anchors belong to the pipeline, timestamps default.
const CARD_STRIP = new Set(['card_unique_id', 'fab_cube_card_id', 'created_at', 'updated_at']);
const PRINTING_STRIP = new Set([
  'printing_id', 'card_unique_id', 'other_face_printing_id', 'fab_cube_printing_id',
  'created_at', 'updated_at',
]);

/** snake_case column name → drizzle property key + column, per table. */
function snakeToPropMap(
  table: typeof cards | typeof printings | typeof cardTranslations,
): Map<string, { prop: string; dataType: string }> {
  const map = new Map<string, { prop: string; dataType: string }>();
  for (const [prop, col] of Object.entries(getTableColumns(table))) {
    map.set(col.name, { prop, dataType: col.dataType });
  }
  return map;
}

const cardProps = snakeToPropMap(cards);
const printingProps = snakeToPropMap(printings);
const translationProps = snakeToPropMap(cardTranslations);
const TRANSLATION_STRIP = new Set(['card_unique_id', 'updated_at']);

function convertRow(
  row: Record<string, unknown>,
  props: Map<string, { prop: string; dataType: string }>,
  strip: Set<string>,
  what: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (strip.has(key)) continue;
    const target = props.get(key);
    if (!target) throw new Error(`unknown ${what} column '${key}' — payload/schema drift`);
    // JSON bodies deliver timestamps as ISO strings; drizzle date-mode
    // columns need a JS Date (see lib/postgres/CLAUDE.md).
    out[target.prop] =
      target.dataType === 'date' && typeof value === 'string' ? new Date(value) : value;
  }
  return out;
}

export class PostgresIngestService {
  async ingestSetRows(input: IngestSetRowsInput): Promise<AsyncResult<IngestSetRowsResult>> {
    try {
      const counts: IngestSetRowsResult = {
        dryRun: !!input.dryRun,
        cardsCreated: 0,
        cardsEnriched: 0,
        cardsMatched: 0,
        printingsCreated: 0,
        printingsSkipped: 0,
        faceLinksSet: 0,
        translationsUpserted: 0,
      };

      // ── resolve cards by natural identity (talishar_card_id) ─────────────
      // talishar_card_id is derived from (display_name, pitch) and unique per
      // logical card; lss_card_id is NOT usable alone (DFC faces share it).
      const talIds = input.cards.map((c) => String(c.talishar_card_id ?? ''));
      if (talIds.some((t) => !t)) {
        return { success: false, error: 'every card row needs talishar_card_id' };
      }
      const existingCards = talIds.length
        ? await db
            .select({
              cardUniqueId: cards.cardUniqueId,
              talisharCardId: cards.talisharCardId,
              fabCubeCardId: cards.fabCubeCardId,
            })
            .from(cards)
            .where(inArray(cards.talisharCardId, talIds))
        : [];
      const byTal = new Map(existingCards.map((c) => [c.talisharCardId, c]));

      // local card_unique_id → this DB's card_unique_id
      const cardIdMap = new Map<string, string>();
      const newCardRows: Array<Record<string, unknown>> = [];
      // Matched PROVISIONAL cards get their fields refreshed (source may carry
      // corrected CardVault data); anchored cards are fab-cube-owned — never touched.
      const enrichRows: Array<{ id: string; values: Record<string, unknown> }> = [];
      for (const c of input.cards) {
        const localId = String(c.card_unique_id ?? '');
        const tal = String(c.talishar_card_id);
        const match = byTal.get(tal);
        let resolved = match?.cardUniqueId;
        if (!resolved) {
          resolved = nanoid();
          byTal.set(tal, { cardUniqueId: resolved, talisharCardId: tal, fabCubeCardId: 'pending-insert' });
          newCardRows.push({ ...convertRow(c, cardProps, CARD_STRIP, 'cards'), cardUniqueId: resolved });
          counts.cardsCreated++;
        } else if (match && match.fabCubeCardId === null) {
          enrichRows.push({ id: resolved, values: convertRow(c, cardProps, CARD_STRIP, 'cards') });
          counts.cardsEnriched++;
        } else {
          counts.cardsMatched++;
        }
        cardIdMap.set(localId, resolved);
      }

      // ── printings: skip existing (lss_print_id), map card refs, mint ids ─
      const lssPrintIds = input.printings.map((p) => p.lss_print_id).filter(Boolean) as string[];
      const existingPrints = lssPrintIds.length
        ? await db
            .select({ printingId: printings.printingId, lssPrintId: printings.lssPrintId })
            .from(printings)
            .where(inArray(printings.lssPrintId, lssPrintIds))
        : [];
      const byLssPrint = new Map(existingPrints.map((p) => [p.lssPrintId, p.printingId]));

      // Natural-key fallback for rows without an lss anchor (same key the 005
      // adoption pass and import-new-set use; deliberately front-face rows
      // only — DFC backs legitimately share the key with their front).
      const existingInSet = await db
        .select({
          collectorNumber: printings.collectorNumber,
          edition: printings.edition,
          foiling: printings.foiling,
          language: printings.language,
          isFrontFace: printings.isFrontFace,
        })
        .from(printings)
        .where(eq(printings.set, input.set));
      const knownNaturalKeys = new Set(
        existingInSet.filter((r) => r.isFrontFace !== false).map((r) =>
          naturalKeyOf({
            set: input.set,
            collector_number: r.collectorNumber ?? '',
            edition: r.edition,
            foiling: r.foiling,
            language: r.language,
          }),
        ),
      );
      // Back faces share the natural key with their front, so they get their
      // own set. fab-cube-sourced DFC rows carry no lss_print_id (FAB232-234),
      // and without this a re-push minted a second back row per pair.
      const knownBackKeys = new Set(
        existingInSet.filter((r) => r.isFrontFace === false).map((r) =>
          naturalKeyOf({
            set: input.set,
            collector_number: r.collectorNumber ?? '',
            edition: r.edition,
            foiling: r.foiling,
            language: r.language,
          }),
        ),
      );

      const newPrintingRows: Array<Record<string, unknown>> = [];
      // local printing_id → this DB's printing_id, for face-pair linking.
      const printIdMap = new Map<string, string>();
      for (const p of input.printings) {
        const localPrintId = String(p.printing_id ?? '');
        if (p.lss_print_id && byLssPrint.has(String(p.lss_print_id))) {
          printIdMap.set(localPrintId, byLssPrint.get(String(p.lss_print_id))!);
          counts.printingsSkipped++;
          continue;
        }
        const isFront = p.is_front_face !== false;
        const nk = naturalKeyOf({
          set: input.set,
          collector_number: String(p.collector_number ?? ''),
          edition: String(p.edition ?? ''),
          foiling: String(p.foiling ?? ''),
          language: String(p.language ?? 'en'),
        });
        if (isFront && knownNaturalKeys.has(nk)) {
          counts.printingsSkipped++;
          continue;
        }
        if (!isFront && knownBackKeys.has(nk)) {
          counts.printingsSkipped++;
          continue;
        }
        if (isFront) knownNaturalKeys.add(nk); else knownBackKeys.add(nk);
        const cardRef = String(p.card_unique_id ?? '');
        const resolvedCard = cardIdMap.get(cardRef);
        if (!resolvedCard) {
          return { success: false, error: `printing ${p.collector_number ?? p.printing_id} references card '${cardRef}' not present in payload` };
        }
        const mintedId = nanoid();
        printIdMap.set(localPrintId, mintedId);
        newPrintingRows.push({
          ...convertRow(p, printingProps, PRINTING_STRIP, 'printings'),
          printingId: mintedId,
          cardUniqueId: resolvedCard,
        });
        counts.printingsCreated++;
      }

      // Face-pair links, expressed in the payload as local-id refs. New rows
      // insert with a NULL link (other_face is stripped), so one guarded
      // UPDATE covers both fresh pairs and retro-links onto existing fronts;
      // an already-linked row is never overwritten.
      const faceLinks: Array<{ printingId: string; otherId: string }> = [];
      for (const p of input.printings) {
        const otherLocal = p.other_face_printing_id ? String(p.other_face_printing_id) : null;
        if (!otherLocal) continue;
        const prodId = printIdMap.get(String(p.printing_id ?? ''));
        const otherProd = printIdMap.get(otherLocal);
        if (prodId && otherProd) faceLinks.push({ printingId: prodId, otherId: otherProd });
      }

      // ── translations: upsert on (card, language), card ref mapped ────────
      const translationRows: Array<Record<string, unknown>> = [];
      for (const t of input.translations ?? []) {
        const resolvedCard = cardIdMap.get(String(t.card_unique_id ?? ''));
        if (!resolvedCard) {
          return { success: false, error: `translation (${t.language}) references card '${t.card_unique_id}' not present in payload` };
        }
        translationRows.push({
          ...convertRow(t, translationProps, TRANSLATION_STRIP, 'card_translations'),
          cardUniqueId: resolvedCard,
        });
      }

      if (input.dryRun) {
        // Plan-only: link count is the upper bound (a live run skips links
        // whose target is already linked), translations always upsert.
        counts.faceLinksSet = faceLinks.length;
        counts.translationsUpserted = translationRows.length;
        return { success: true, data: counts };
      }

      await db.transaction(async (tx) => {
        if (newCardRows.length) await tx.insert(cards).values(newCardRows as any);
        for (const e of enrichRows) {
          await tx.update(cards).set(e.values as any)
            .where(and(eq(cards.cardUniqueId, e.id), isNull(cards.fabCubeCardId)));
        }
        if (newPrintingRows.length) await tx.insert(printings).values(newPrintingRows as any);
        for (const l of faceLinks) {
          const updated = await tx.update(printings)
            .set({ otherFacePrintingId: l.otherId })
            .where(and(eq(printings.printingId, l.printingId), isNull(printings.otherFacePrintingId)))
            .returning({ printingId: printings.printingId });
          counts.faceLinksSet += updated.length;
        }
        for (const t of translationRows) {
          const { cardUniqueId, language, ...rest } = t as { cardUniqueId: string; language: string };
          await tx.insert(cardTranslations)
            .values(t as any)
            .onConflictDoUpdate({
              target: [cardTranslations.cardUniqueId, cardTranslations.language],
              set: rest as any,
            });
          counts.translationsUpserted++;
        }
      });

      return { success: true, data: counts };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'ingest failed' };
    }
  }
}
