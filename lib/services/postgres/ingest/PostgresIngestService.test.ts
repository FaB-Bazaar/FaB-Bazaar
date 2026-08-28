/**
 * Integration tests for PostgresIngestService.ingestSetRows — the service
 * behind POST /api/admin/printings/ingest (remote set ingest, no SSH).
 *
 * Payload rows are snake_case column maps straight from a source DB's
 * cards/printings tables. The ids inside them (card_unique_id, printing_id,
 * other_face_printing_id) are LOCAL REFS ONLY — this DB resolves rows by
 * natural identity (talishar_card_id / lss_card_id for cards, lss_print_id /
 * natural key for printings) and mints its own ids for anything it creates.
 */
import { describe, test, expect, afterEach } from 'vitest';
import { db } from '@/lib/postgres/db';
import { cards, printings, cardTranslations } from '@/lib/postgres/schema';
import { eq, inArray } from 'drizzle-orm';
import { PostgresIngestService } from './PostgresIngestService';

const service = new PostgresIngestService();

// Unique set code per test run so parallel test files can never collide.
const testSet = `zz${crypto.randomUUID().slice(0, 8)}`;

const localCardId = () => `local-card-${crypto.randomUUID().slice(0, 12)}`;
const localPrintingId = () => `local-print-${crypto.randomUUID().slice(0, 12)}`;

function cardRow(overrides: Record<string, unknown> = {}) {
  const suffix = crypto.randomUUID().slice(0, 8);
  return {
    card_unique_id: localCardId(),
    name: `zz ingest test card ${suffix}`,
    display_name: `Zz Ingest Test Card ${suffix}`,
    talishar_card_id: `zz-ingest-test-card-${suffix}-red`,
    lss_card_id: crypto.randomUUID(),
    pitch: 1,
    text: 'Test text.',
    types: ['action'],
    is_action: true,
    ...overrides,
  };
}

function printingRow(card: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    printing_id: localPrintingId(),
    card_unique_id: card.card_unique_id,
    set: testSet,
    collector_number: `ZZ${crypto.randomUUID().slice(0, 6)}`,
    edition: 'n',
    foiling: 's',
    rarity: 'r',
    language: 'en',
    lss_print_id: crypto.randomUUID(),
    lss_print_code: 'ZZ000',
    image_url: 'https://imagedelivery.net/test/ZZ000/public',
    ...overrides,
  };
}

afterEach(async () => {
  const rows = await db
    .select({ cardUniqueId: printings.cardUniqueId })
    .from(printings)
    .where(eq(printings.set, testSet));
  const cardIds = [...new Set(rows.map((r) => r.cardUniqueId))];
  await db.delete(printings).where(eq(printings.set, testSet));
  if (cardIds.length) {
    await db.delete(cardTranslations).where(inArray(cardTranslations.cardUniqueId, cardIds));
    await db.delete(cards).where(inArray(cards.cardUniqueId, cardIds));
  }
});

describe('PostgresIngestService.ingestSetRows', () => {
  test('creates new cards and printings with freshly minted ids, mapping local refs', async () => {
    const card = cardRow();
    const printing = printingRow(card);

    const result = await service.ingestSetRows({
      set: testSet,
      cards: [card],
      printings: [printing],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.cardsCreated).toBe(1);
    expect(result.data.printingsCreated).toBe(1);

    const insertedPrintings = await db.select().from(printings).where(eq(printings.set, testSet));
    expect(insertedPrintings).toHaveLength(1);
    const p = insertedPrintings[0];
    // Server minted its own ids — the local refs must not leak in.
    expect(p.printingId).not.toBe(printing.printing_id);
    expect(p.cardUniqueId).not.toBe(card.card_unique_id);
    expect(p.lssPrintId).toBe(printing.lss_print_id);
    expect(p.collectorNumber).toBe(printing.collector_number);
    expect(p.imageUrl).toBe(printing.image_url);

    const insertedCards = await db.select().from(cards).where(eq(cards.cardUniqueId, p.cardUniqueId));
    expect(insertedCards).toHaveLength(1);
    expect(insertedCards[0].name).toBe(card.name);
    expect(insertedCards[0].talisharCardId).toBe(card.talishar_card_id);
    expect(insertedCards[0].lssCardId).toBe(card.lss_card_id);
  });

  test('is idempotent — a second identical call skips by lss_print_id and creates nothing', async () => {
    const card = cardRow();
    const printing = printingRow(card);
    const payload = { set: testSet, cards: [card], printings: [printing] };

    const first = await service.ingestSetRows(payload);
    expect(first.success).toBe(true);

    const second = await service.ingestSetRows(payload);
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.data.cardsCreated).toBe(0);
    // Matched provisional cards are re-enriched on every run (same as the CLI).
    expect(second.data.cardsEnriched).toBe(1);
    expect(second.data.printingsCreated).toBe(0);
    expect(second.data.printingsSkipped).toBe(1);

    const rows = await db.select().from(printings).where(eq(printings.set, testSet));
    expect(rows).toHaveLength(1);
  });

  test('skips a printing whose natural key already exists even without lss_print_id', async () => {
    const card = cardRow();
    const printing = printingRow(card);
    const first = await service.ingestSetRows({ set: testSet, cards: [card], printings: [printing] });
    expect(first.success).toBe(true);

    // Same natural key (set, collector, edition, foiling, language), no lss id
    // — e.g. a row that predates CardVault linkage on the source side.
    const again = { ...printing, printing_id: localPrintingId(), lss_print_id: null };
    const second = await service.ingestSetRows({ set: testSet, cards: [card], printings: [again] });
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.data.printingsCreated).toBe(0);
    expect(second.data.printingsSkipped).toBe(1);

    const rows = await db.select().from(printings).where(eq(printings.set, testSet));
    expect(rows).toHaveLength(1);
  });

  test('enriches a matched provisional card but never touches a fab-cube-anchored one', async () => {
    const provisional = cardRow();
    const anchored = cardRow();
    const p1 = printingRow(provisional);
    const p2 = printingRow(anchored);
    const first = await service.ingestSetRows({
      set: testSet, cards: [provisional, anchored], printings: [p1, p2],
    });
    expect(first.success).toBe(true);

    // Anchor the second card the way pipeline 005 would.
    const anchoredId = (await db.select({ id: cards.cardUniqueId }).from(cards)
      .where(eq(cards.talisharCardId, anchored.talishar_card_id as string)))[0].id;
    await db.update(cards).set({ fabCubeCardId: crypto.randomUUID() })
      .where(eq(cards.cardUniqueId, anchoredId));

    const second = await service.ingestSetRows({
      set: testSet,
      cards: [
        { ...provisional, text: 'Corrected text.' },
        { ...anchored, text: 'Must not land.' },
      ],
      printings: [p1, p2],
    });
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.data.cardsEnriched).toBe(1);
    expect(second.data.cardsMatched).toBe(1);
    expect(second.data.cardsCreated).toBe(0);

    const provRow = (await db.select().from(cards)
      .where(eq(cards.talisharCardId, provisional.talishar_card_id as string)))[0];
    expect(provRow.text).toBe('Corrected text.');
    const anchRow = (await db.select().from(cards).where(eq(cards.cardUniqueId, anchoredId)))[0];
    expect(anchRow.text).toBe('Test text.');
  });

  test('links a DFC face pair both ways using the payload-local other_face refs', async () => {
    const frontCard = cardRow();
    const backCard = cardRow();
    const front = printingRow(frontCard, { is_front_face: true });
    const back = printingRow(backCard, {
      is_front_face: false,
      collector_number: front.collector_number,
      other_face_printing_id: front.printing_id,
    });
    (front as Record<string, unknown>).other_face_printing_id = back.printing_id;

    const result = await service.ingestSetRows({
      set: testSet, cards: [frontCard, backCard], printings: [front, back],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.printingsCreated).toBe(2);
    expect(result.data.faceLinksSet).toBe(2);

    const rows = await db.select().from(printings).where(eq(printings.set, testSet));
    expect(rows).toHaveLength(2);
    const f = rows.find((r) => r.isFrontFace)!;
    const b = rows.find((r) => !r.isFrontFace)!;
    expect(f.otherFacePrintingId).toBe(b.printingId);
    expect(b.otherFacePrintingId).toBe(f.printingId);
  });

  test('retro-links a back face onto a front ingested in an earlier push', async () => {
    const frontCard = cardRow();
    const front = printingRow(frontCard);
    const first = await service.ingestSetRows({ set: testSet, cards: [frontCard], printings: [front] });
    expect(first.success).toBe(true);

    const backCard = cardRow();
    const back = printingRow(backCard, {
      is_front_face: false,
      collector_number: front.collector_number,
      other_face_printing_id: front.printing_id,
    });
    const second = await service.ingestSetRows({
      set: testSet,
      cards: [frontCard, backCard],
      printings: [{ ...front, other_face_printing_id: back.printing_id }, back],
    });
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.data.printingsCreated).toBe(1);
    expect(second.data.printingsSkipped).toBe(1);
    expect(second.data.faceLinksSet).toBe(2);

    const rows = await db.select().from(printings).where(eq(printings.set, testSet));
    const f = rows.find((r) => r.isFrontFace)!;
    const b = rows.find((r) => !r.isFrontFace)!;
    expect(f.otherFacePrintingId).toBe(b.printingId);
    expect(b.otherFacePrintingId).toBe(f.printingId);
  });

  test('upserts card_translations rows, mapping the local card ref', async () => {
    const card = cardRow();
    const printing = printingRow(card);
    const translation = {
      card_unique_id: card.card_unique_id,
      language: 'fr',
      name: 'carte de test zz',
      display_name: 'Carte de Test Zz',
      text: 'Texte.',
      source: 'lss',
    };

    const first = await service.ingestSetRows({
      set: testSet, cards: [card], printings: [printing], translations: [translation],
    });
    expect(first.success).toBe(true);
    if (!first.success) return;
    expect(first.data.translationsUpserted).toBe(1);

    const prodCardId = (await db.select({ id: cards.cardUniqueId }).from(cards)
      .where(eq(cards.talisharCardId, card.talishar_card_id as string)))[0].id;
    let rows = await db.select().from(cardTranslations)
      .where(eq(cardTranslations.cardUniqueId, prodCardId));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('carte de test zz');

    // Upsert: same key, changed content → updated in place, no duplicate.
    const second = await service.ingestSetRows({
      set: testSet, cards: [card], printings: [printing],
      translations: [{ ...translation, text: 'Texte corrigé.' }],
    });
    expect(second.success).toBe(true);
    rows = await db.select().from(cardTranslations)
      .where(eq(cardTranslations.cardUniqueId, prodCardId));
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toBe('Texte corrigé.');
  });

  test('dryRun reports the full plan without writing anything', async () => {
    const card = cardRow();
    const printing = printingRow(card);

    const result = await service.ingestSetRows({
      set: testSet, cards: [card], printings: [printing], dryRun: true,
      translations: [{
        card_unique_id: card.card_unique_id, language: 'fr',
        name: 'zz', display_name: 'Zz',
      }],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.dryRun).toBe(true);
    expect(result.data.cardsCreated).toBe(1);
    expect(result.data.printingsCreated).toBe(1);
    expect(result.data.translationsUpserted).toBe(1);

    const rows = await db.select().from(printings).where(eq(printings.set, testSet));
    expect(rows).toHaveLength(0);
  });

  test('coerces ISO-string timestamps from the JSON body into Dates', async () => {
    const card = cardRow();
    const printing = printingRow(card, { price_updated_at: '2026-08-01T00:00:00.000Z' });

    const result = await service.ingestSetRows({ set: testSet, cards: [card], printings: [printing] });
    expect(result.success).toBe(true);

    const rows = await db.select().from(printings).where(eq(printings.set, testSet));
    expect(rows).toHaveLength(1);
    expect(rows[0].priceUpdatedAt).toEqual(new Date('2026-08-01T00:00:00.000Z'));
  });

  test('rejects a payload row carrying an unknown column (schema drift guard)', async () => {
    const card = cardRow({ zz_not_a_column: 'boom' });
    const result = await service.ingestSetRows({
      set: testSet, cards: [card], printings: [printingRow(card)],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('zz_not_a_column');
  });
});
