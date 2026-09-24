import { db } from '@/lib/postgres/db';
import { marketFeedListings } from '@/lib/postgres/schema';
import { eq, sql } from 'drizzle-orm';
import { FOILING_MAP } from '@/lib/fab-constants/foilings';
import type { AsyncResult } from '../../contracts/common';

/**
 * market_feed_listings (migration 0115): a curated, anonymous daily feed of
 * buy/sell prices seen in Facebook groups, submitted by a superadmin MCP
 * client. One submission = one whole day; re-submitting a date replaces it.
 */

export const MARKET_FEED_SIDES = ['selling', 'buying'] as const;
export type MarketFeedSide = (typeof MARKET_FEED_SIDES)[number];

export const MARKET_FEED_CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const;

/** Upper bound per day — keeps one call from writing an unbounded batch. */
export const MARKET_FEED_MAX_LISTINGS = 500;

export interface MarketFeedListingInput {
  side: MarketFeedSide;
  /** Card name as the post gave it. */
  cardName: string;
  /** 1 red, 2 yellow, 3 blue — disambiguates pitched cards. */
  pitch?: number | null;
  /** e.g. WTR171 — pins the set/printing when the post names it. */
  collectorNumber?: string | null;
  /** Any FOILING_MAP spelling: 'Rainbow Foil', 'rf', 'cold', … */
  foiling?: string | null;
  condition?: string | null;
  price: number;
  /** ISO 4217, default USD. */
  currency?: string | null;
  groupName?: string | null;
}

export interface ReplaceMarketFeedDayInput {
  feedDate: string;
  listings: MarketFeedListingInput[];
  createdBy?: string | null;
}

export interface MarketFeedListing {
  id: string;
  side: MarketFeedSide;
  cardName: string;
  cardUniqueId: string | null;
  /** Our display name for the matched card. */
  displayName: string | null;
  pitch: number | null;
  collectorNumber: string | null;
  /** Foiling code (r/c/g/s). */
  foiling: string | null;
  condition: string | null;
  price: number;
  currency: string;
  groupName: string | null;
  /** Cheapest English TCG Low for the matched card (+ foiling / collector number when given). */
  tcgLow: number | null;
  imageUrl: string | null;
}

export interface MarketFeedDay {
  feedDate: string;
  listings: MarketFeedListing[];
}

export interface MarketFeedDateSummary {
  feedDate: string;
  count: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidFeedDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const FOILING_CODES: Record<string, string> = {
  'Rainbow Foil': 'r',
  'Cold Foil': 'c',
  'Gold Foil': 'g',
  'Non-foil': 's',
};

function toFoilingCode(input: string): string | null {
  const name = (FOILING_MAP as Record<string, string>)[input.trim().toLowerCase()];
  return name ? FOILING_CODES[name] ?? null : null;
}

const clean = (v: string | null | undefined) => {
  const t = typeof v === 'string' ? v.trim() : '';
  return t === '' ? null : t;
};

type NormalizedListing = {
  side: MarketFeedSide;
  cardName: string;
  pitch: number | null;
  collectorNumber: string | null;
  foiling: string | null;
  condition: string | null;
  price: string;
  currency: string;
  groupName: string | null;
};

function normalizeListing(l: MarketFeedListingInput, index: number):
  { ok: true; value: NormalizedListing } | { ok: false; error: string } {
  const at = `listings[${index}]`;
  if (!l || typeof l !== 'object') return { ok: false, error: `${at} must be an object` };
  if (!MARKET_FEED_SIDES.includes(l.side)) {
    return { ok: false, error: `${at}.side must be 'selling' or 'buying'` };
  }
  const cardName = clean(l.cardName);
  if (!cardName) return { ok: false, error: `${at}.cardName is required` };
  if (typeof l.price !== 'number' || !Number.isFinite(l.price) || l.price <= 0 || l.price >= 1e8) {
    return { ok: false, error: `${at}.price must be a positive number` };
  }
  let pitch: number | null = null;
  if (l.pitch != null) {
    if (![1, 2, 3].includes(l.pitch)) return { ok: false, error: `${at}.pitch must be 1, 2 or 3` };
    pitch = l.pitch;
  }
  let foiling: string | null = null;
  const foilingInput = clean(l.foiling);
  if (foilingInput) {
    foiling = toFoilingCode(foilingInput);
    if (!foiling) return { ok: false, error: `${at}.foiling '${foilingInput}' is not a known foiling` };
  }
  let condition: string | null = null;
  const conditionInput = clean(l.condition);
  if (conditionInput) {
    condition = conditionInput.toUpperCase();
    if (!(MARKET_FEED_CONDITIONS as readonly string[]).includes(condition)) {
      return { ok: false, error: `${at}.condition must be one of ${MARKET_FEED_CONDITIONS.join(', ')}` };
    }
  }
  const currency = (clean(l.currency) ?? 'USD').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: `${at}.currency must be a 3-letter code` };

  return {
    ok: true,
    value: {
      side: l.side,
      cardName,
      pitch,
      collectorNumber: clean(l.collectorNumber)?.toUpperCase() ?? null,
      foiling,
      condition,
      price: l.price.toFixed(2),
      currency,
      groupName: clean(l.groupName),
    },
  };
}

export class PostgresMarketFeedService {
  /** Resolve a listing to one card_unique_id, or null when unmatched/ambiguous. */
  private async resolveCard(l: NormalizedListing): Promise<{ cardUniqueId: string; pitch: number | null } | null> {
    const pitchFilter = l.pitch != null ? sql`AND c.pitch = ${l.pitch}` : sql``;
    const rows = l.collectorNumber
      ? (await db.execute<{ card_unique_id: string; pitch: number | null }>(sql`
          SELECT DISTINCT c.card_unique_id, c.pitch
          FROM printings p JOIN cards c ON c.card_unique_id = p.card_unique_id
          WHERE upper(p.collector_number) = ${l.collectorNumber} ${pitchFilter}
          LIMIT 2`)).rows
      : (await db.execute<{ card_unique_id: string; pitch: number | null }>(sql`
          SELECT c.card_unique_id, c.pitch FROM cards c
          WHERE lower(c.name) = lower(${l.cardName}) ${pitchFilter}
          LIMIT 2`)).rows;
    if (rows.length !== 1) return null;
    return { cardUniqueId: rows[0].card_unique_id, pitch: rows[0].pitch };
  }

  async replaceDay(input: ReplaceMarketFeedDayInput): AsyncResult<{ feedDate: string; count: number; unmatched: string[] }> {
    try {
      if (!isValidFeedDate(input.feedDate)) {
        return { success: false, error: 'feedDate must be a YYYY-MM-DD date' };
      }
      if (!Array.isArray(input.listings)) return { success: false, error: 'listings must be an array' };
      if (input.listings.length > MARKET_FEED_MAX_LISTINGS) {
        return { success: false, error: `At most ${MARKET_FEED_MAX_LISTINGS} listings per day` };
      }

      const normalized: NormalizedListing[] = [];
      for (let i = 0; i < input.listings.length; i++) {
        const n = normalizeListing(input.listings[i], i);
        if (!n.ok) return { success: false, error: n.error };
        normalized.push(n.value);
      }

      const unmatched: string[] = [];
      const rows: (typeof marketFeedListings.$inferInsert)[] = [];
      for (const l of normalized) {
        const match = await this.resolveCard(l);
        if (!match) unmatched.push(l.cardName);
        rows.push({
          id: crypto.randomUUID(),
          feedDate: input.feedDate,
          ...l,
          cardUniqueId: match?.cardUniqueId ?? null,
          pitch: l.pitch ?? match?.pitch ?? null,
          createdBy: input.createdBy ?? null,
        });
      }

      await db.transaction(async (tx) => {
        await tx.delete(marketFeedListings).where(eq(marketFeedListings.feedDate, input.feedDate));
        if (rows.length) await tx.insert(marketFeedListings).values(rows);
      });

      return { success: true, data: { feedDate: input.feedDate, count: rows.length, unmatched: [...new Set(unmatched)] } };
    } catch (error) {
      console.error('[market-feed] replaceDay failed:', error);
      return { success: false, error: 'Failed to save market feed' };
    }
  }

  async getDay(feedDate: string): AsyncResult<MarketFeedDay> {
    try {
      if (!isValidFeedDate(feedDate)) return { success: false, error: 'feedDate must be a YYYY-MM-DD date' };
      // Price + image come from the cheapest English printing matching the
      // listing's collector number / foiling when it gave them (tcg_low is THE price).
      const result = await db.execute<{
        id: string; side: MarketFeedSide; card_name: string; card_unique_id: string | null;
        display_name: string | null; pitch: number | null; collector_number: string | null;
        foiling: string | null; condition: string | null; price: string; currency: string;
        group_name: string | null; tcg_low: number | null; image_url: string | null;
      }>(sql`
        SELECT l.id, l.side, l.card_name, l.card_unique_id, c.display_name, l.pitch,
               l.collector_number, l.foiling, l.condition, l.price, l.currency, l.group_name,
               px.tcg_low, img.image_url
        FROM market_feed_listings l
        LEFT JOIN cards c ON c.card_unique_id = l.card_unique_id
        LEFT JOIN LATERAL (
          SELECT MIN(p.tcg_low) AS tcg_low FROM printings p
          WHERE p.card_unique_id = l.card_unique_id AND p.language = 'en'
            AND (l.foiling IS NULL OR p.foiling = l.foiling)
            AND (l.collector_number IS NULL OR upper(p.collector_number) = l.collector_number)
        ) px ON true
        LEFT JOIN LATERAL (
          SELECT p.image_url FROM printings p
          WHERE p.card_unique_id = l.card_unique_id
          ORDER BY (p.image_url IS NOT NULL) DESC,
                   (l.collector_number IS NOT NULL AND upper(p.collector_number) = l.collector_number) DESC,
                   (p.language = 'en') DESC, p.set, p.edition
          LIMIT 1
        ) img ON true
        WHERE l.feed_date = ${feedDate}
        ORDER BY coalesce(c.display_name, l.card_name), l.side, l.price`);

      return {
        success: true,
        data: {
          feedDate,
          listings: result.rows.map((r) => ({
            id: r.id,
            side: r.side,
            cardName: r.card_name,
            cardUniqueId: r.card_unique_id,
            displayName: r.display_name,
            pitch: r.pitch,
            collectorNumber: r.collector_number,
            foiling: r.foiling,
            condition: r.condition,
            price: Number(r.price),
            currency: r.currency,
            groupName: r.group_name,
            tcgLow: r.tcg_low == null ? null : Number(r.tcg_low),
            imageUrl: r.image_url,
          })),
        },
      };
    } catch (error) {
      console.error('[market-feed] getDay failed:', error);
      return { success: false, error: 'Failed to load market feed' };
    }
  }

  async listDates(limit = 60): AsyncResult<MarketFeedDateSummary[]> {
    try {
      const result = await db.execute<{ feed_date: string; count: number }>(sql`
        SELECT feed_date::text AS feed_date, count(*)::int AS count
        FROM market_feed_listings
        GROUP BY feed_date ORDER BY feed_date DESC
        LIMIT ${Math.max(1, Math.min(limit, 1000))}`);
      return { success: true, data: result.rows.map((r) => ({ feedDate: r.feed_date, count: Number(r.count) })) };
    } catch (error) {
      console.error('[market-feed] listDates failed:', error);
      return { success: false, error: 'Failed to list market feed dates' };
    }
  }
}
