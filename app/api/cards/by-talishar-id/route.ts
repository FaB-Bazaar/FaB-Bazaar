// /api/cards/by-talishar-id
//
// Resolves Talishar's internal card identifier (the `cardId` field emitted in
// game_results.card_results, opponent_card_results, turn_log, etc.) to a card
// row in `cards`, joined with the cheapest/first printing for an image URL.
//
// GET  ?id=titans_fist        → { success: true, data: CardLookup | null }
// POST { ids: [...] }         → { success: true, data: { [inputId]: CardLookup } }
//
// Notes:
//   - Input ids are run through `normalizeTalisharId` (strips _equip/_ally/_r
//     state suffixes and the alt-art SET-prefix used for Inner Chi variants),
//     so callers can pass raw Talishar ids straight from a game log.
//   - The POST response is keyed by the *input* id, so callers don't have to
//     reverse the normalization themselves.
//   - No auth: card data is public. Same as /api/printings/images.

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/postgres/db';
import { normalizeTalisharId } from '@/lib/talishar/cardId';

const MAX_BATCH = 500;

interface CardLookup {
  cardUniqueId: string;
  displayName: string;
  pitch: number | null;
  imageUrl: string | null;
  talisharCardId: string;
}

interface DbRow {
  card_unique_id: string;
  display_name: string;
  pitch: number | null;
  image_url: string | null;
  talishar_card_id: string;
}

// One query, one round-trip. DISTINCT ON picks a single printing per card
// (ordered by set/edition so the result is deterministic). The index on
// cards.talishar_card_id makes this an indexed equality lookup.
async function lookupByTalisharIds(normalizedIds: string[]): Promise<Map<string, CardLookup>> {
  if (normalizedIds.length === 0) return new Map();

  const { rows } = await pool.query<DbRow>(
    `SELECT DISTINCT ON (c.card_unique_id)
            c.card_unique_id, c.display_name, c.pitch,
            c.talishar_card_id, p.image_url
     FROM cards c
     LEFT JOIN printings p ON p.card_unique_id = c.card_unique_id
     WHERE c.talishar_card_id = ANY($1)
     ORDER BY c.card_unique_id, p.set ASC NULLS LAST, p.edition ASC NULLS LAST`,
    [normalizedIds]
  );

  const byId = new Map<string, CardLookup>();
  for (const r of rows) {
    byId.set(r.talishar_card_id, {
      cardUniqueId: r.card_unique_id,
      displayName: r.display_name,
      pitch: r.pitch,
      imageUrl: r.image_url,
      talisharCardId: r.talishar_card_id,
    });
  }
  return byId;
}

export async function GET(request: NextRequest) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing `id` query parameter' }, { status: 400 });
  }

  const normalized = normalizeTalisharId(id);
  const lookup = await lookupByTalisharIds([normalized]);
  return NextResponse.json({ success: true, data: lookup.get(normalized) ?? null });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids)) {
    return NextResponse.json({ success: false, error: 'Body must be `{ ids: string[] }`' }, { status: 400 });
  }
  const cleanInputs = ids
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .slice(0, MAX_BATCH);

  // Map each input id to its normalized form, dedupe normalized ids for the query.
  const inputToNormalized = new Map<string, string>();
  for (const input of cleanInputs) inputToNormalized.set(input, normalizeTalisharId(input));
  const uniqueNormalized = Array.from(new Set(inputToNormalized.values()));

  const byNormalized = await lookupByTalisharIds(uniqueNormalized);

  // Re-key the response by the original (un-normalized) input id so callers
  // don't have to reverse the normalization on their side.
  const data: Record<string, CardLookup> = {};
  for (const [input, normalized] of inputToNormalized) {
    const card = byNormalized.get(normalized);
    if (card) data[input] = card;
  }
  return NextResponse.json({ success: true, data });
}
