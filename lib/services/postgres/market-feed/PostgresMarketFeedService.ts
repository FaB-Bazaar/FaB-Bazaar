import { db } from '@/lib/postgres/db';
import { marketFeedListings } from '@/lib/postgres/schema';
import { eq, sql } from 'drizzle-orm';
import { FOILING_MAP, ART_VARIATIONS_MAP } from '@/lib/fab-constants/foilings';
import type { AsyncResult } from '../../contracts/common';

/**
 * market_feed_listings (migration 0115): a curated, anonymous daily feed of
 * buy/sell prices seen in Facebook groups, submitted by a superadmin MCP
 * client. One submission = one whole day; re-submitting a date replaces it.
 * 'trade' rows (0117) are cards a poster wants in exchange — no price.
 */

export const MARKET_FEED_SIDES = ['selling', 'buying', 'trade'] as const;
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
  /** Required for selling/buying; optional on 'trade' (wanted in exchange). */
  price?: number | null;
  /** Marvel / Extended Art / Alternate Art / Full Art … (aliases: mv, ea, aa, fa). */
  variant?: string | null;
  /** ISO 4217, default USD. */
  currency?: string | null;
  groupName?: string | null;
  /** Link to the Facebook post (https Facebook URL; tracking params are stripped). */
  postUrl?: string | null;
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
  /** NULL on 'trade' listings without a stated value. */
  price: number | null;
  currency: string;
  groupName: string | null;
  postUrl: string | null;
  variant: string | null;
  /** Cheapest English TCG Low for the matched card (+ foiling / collector number when given). */
  tcgLow: number | null;
  imageUrl: string | null;
}

export interface MarketFeedDay {
  feedDate: string;
  listings: MarketFeedListing[];
}

/** What the signed-in viewer holds of the cards in one day's feed, keyed by card_unique_id. */
export interface MarketFeedViewerMatches {
  owned: Record<string, { quantity: number; forTradeQuantity: number; foilings: string[]; variants: string[] }>;
  wanted: Record<string, { foilings: string[] }>;
}

/** A listing whose name only matched loosely (typo, missing space/hyphen, shortened). */
export interface MarketFeedLooseMatch {
  cardName: string;
  matchedName: string;
}

/** Closest cards for a name that could not be matched, so the client can fix and resubmit. */
export interface MarketFeedSuggestion {
  cardName: string;
  candidates: { name: string; pitch: number | null; collectorNumbers: string[] }[];
}

export interface MarketFeedReplaceResult {
  feedDate: string;
  count: number;
  unmatched: string[];
  looseMatches: MarketFeedLooseMatch[];
  suggestions: MarketFeedSuggestion[];
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

// Marvel is a rarity ('v'), not an art_variations code; the rest are.
const VARIANT_ART_CODES: Record<string, string> = {
  'Alternate Border': 'AB',
  'Alternate Art': 'AA',
  'Alternate Text': 'AT',
  'Extended Art': 'EA',
  'Full Art': 'FA',
  'Half Size': 'HS',
};
const VARIANT_ALIASES: Record<string, string> = {
  ...(ART_VARIATIONS_MAP as Record<string, string>),
  marvel: 'Marvel',
  mv: 'Marvel',
  'alt art': 'Alternate Art',
};

// SQL: the art_variations code for a listing's variant (built from constants only).
const VARIANT_CODE_SQL = sql.raw(
  `CASE l.variant ${Object.entries(VARIANT_ART_CODES).map(([label, code]) => `WHEN '${label}' THEN '${code}'`).join(' ')} END`,
);

function toVariant(input: string): string | null {
  return VARIANT_ALIASES[input.trim().toLowerCase()] ?? null;
}

function toFoilingCode(input: string): string | null {
  const name = (FOILING_MAP as Record<string, string>)[input.trim().toLowerCase()];
  return name ? FOILING_CODES[name] ?? null : null;
}

const FACEBOOK_HOST = /^(?:[a-z0-9-]+\.)*(?:facebook\.com|fb\.com)$/i;
// permalink/story links carry the post id in the query; everything else is
// path-addressed, so its query string is only tracking (__cft__, mibextid, …).
const QUERY_ID_PARAMS: Record<string, string[]> = {
  '/permalink.php': ['story_fbid', 'id'],
  '/story.php': ['story_fbid', 'id'],
};

/** https Facebook URL with tracking stripped, or null if it isn't one. */
export function normalizeFacebookPostUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !FACEBOOK_HOST.test(url.hostname) || url.username || url.password) return null;
  const keep = QUERY_ID_PARAMS[url.pathname] ?? [];
  const query = new URLSearchParams();
  for (const k of keep) {
    const v = url.searchParams.get(k);
    if (v) query.set(k, v);
  }
  const qs = query.toString();
  return `https://${url.hostname.toLowerCase()}${url.pathname}${qs ? `?${qs}` : ''}`;
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
  price: string | null;
  currency: string;
  groupName: string | null;
  postUrl: string | null;
  variant: string | null;
};

function normalizeListing(l: MarketFeedListingInput, index: number):
  { ok: true; value: NormalizedListing } | { ok: false; error: string } {
  const at = `listings[${index}]`;
  if (!l || typeof l !== 'object') return { ok: false, error: `${at} must be an object` };
  if (!MARKET_FEED_SIDES.includes(l.side)) {
    return { ok: false, error: `${at}.side must be 'selling', 'buying' or 'trade'` };
  }
  const cardName = clean(l.cardName);
  if (!cardName) return { ok: false, error: `${at}.cardName is required` };
  const priceGiven = l.price != null;
  if (priceGiven || l.side !== 'trade') {
    if (typeof l.price !== 'number' || !Number.isFinite(l.price) || l.price <= 0 || l.price >= 1e8) {
      return { ok: false, error: `${at}.price must be a positive number` };
    }
  }
  let variant: string | null = null;
  const variantInput = clean(l.variant);
  if (variantInput) {
    variant = toVariant(variantInput);
    if (!variant) return { ok: false, error: `${at}.variant '${variantInput}' is not a known variant (Marvel, Extended Art, Alternate Art, Full Art, …)` };
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
  let postUrl: string | null = null;
  const postUrlInput = clean(l.postUrl);
  if (postUrlInput) {
    postUrl = normalizeFacebookPostUrl(postUrlInput);
    if (!postUrl) return { ok: false, error: `${at}.postUrl must be an https facebook.com link` };
  }

  return {
    ok: true,
    value: {
      side: l.side,
      cardName,
      pitch,
      collectorNumber: clean(l.collectorNumber)?.toUpperCase() ?? null,
      foiling,
      condition,
      price: typeof l.price === 'number' ? l.price.toFixed(2) : null,
      currency,
      groupName: clean(l.groupName),
      postUrl,
      variant,
    },
  };
}

// Loose matching (pg_trgm): accept the best card only when it is clearly
// close AND clearly ahead of the next-closest name — a near tie is a guess.
const LOOSE_MIN_SCORE = 0.6;
const LOOSE_MIN_MARGIN = 0.2;
const SUGGESTION_MIN_SCORE = 0.3;

type ResolvedCard = { cardUniqueId: string; pitch: number | null; looseName?: string };

export class PostgresMarketFeedService {
  /**
   * Closest card names to a listing's name: trigram similarity, plus
   * word_similarity so a shortened name ("Boneseer") scores against the full
   * one ("Boneseer Skullcap"). One row per card (pitches are separate cards).
   */
  private async closeCards(l: NormalizedListing, limit: number) {
    const input = l.cardName.replace(/\s*\((young|adult)\)\s*$/i, '').trim().toLowerCase();
    const pitchFilter = l.pitch != null ? sql`AND c.pitch = ${l.pitch}` : sql``;
    return (await db.execute<{ card_unique_id: string; name: string; display_name: string; pitch: number | null; score: number }>(sql`
      SELECT c.card_unique_id, c.name, c.display_name, c.pitch,
             GREATEST(similarity(c.name, ${input}), word_similarity(${input}, c.name)) AS score
      FROM cards c
      WHERE (c.name % ${input} OR ${input} <% c.name) ${pitchFilter}
      ORDER BY score DESC, c.name
      LIMIT ${limit}`)).rows.map((r) => ({ ...r, score: Number(r.score) }));
  }

  /** Loose match: a single card whose name is clearly the closest. */
  private async looseMatch(l: NormalizedListing): Promise<ResolvedCard | null> {
    const rows = await this.closeCards(l, 12);
    if (!rows.length || rows[0].score < LOOSE_MIN_SCORE) return null;
    const top = rows[0];
    // Pitches share a name: the runner-up is the next DIFFERENT name.
    const runnerUp = rows.find((r) => r.name !== top.name);
    if (runnerUp && top.score - runnerUp.score < LOOSE_MIN_MARGIN) return null;
    const sameName = rows.filter((r) => r.name === top.name);
    if (sameName.length !== 1) return null; // pitched card without pitch — let the client say which
    return { cardUniqueId: top.card_unique_id, pitch: top.pitch, looseName: top.display_name };
  }

  private async suggest(l: NormalizedListing): Promise<MarketFeedSuggestion> {
    const rows = (await this.closeCards(l, 5)).filter((r) => r.score >= SUGGESTION_MIN_SCORE);
    const candidates = [];
    for (const r of rows) {
      const cns = (await db.execute<{ collector_number: string }>(sql`
        SELECT DISTINCT upper(collector_number) AS collector_number FROM printings
        WHERE card_unique_id = ${r.card_unique_id} AND language = 'en' AND collector_number IS NOT NULL
        ORDER BY 1 LIMIT 3`)).rows.map((x) => x.collector_number);
      candidates.push({ name: r.display_name, pitch: r.pitch, collectorNumbers: cns });
    }
    return { cardName: l.cardName, candidates };
  }

  /**
   * Resolve a listing to one card_unique_id, or null when unmatched/ambiguous.
   * Posts are messy, so name and collector number are cross-checked:
   *   - a recognised name wins over a collector number that points at a
   *     different card (a mistyped/misread number);
   *   - an unrecognised name (typo) falls back to the collector number;
   *   - a collector number we don't hold falls back to the name.
   * "(Young)" / "(Adult)" suffixes pick the young/adult hero card — young
   * heroes carry the short name ("Malice, Domina of the Dead" → "malice").
   */
  private async resolveCard(l: NormalizedListing): Promise<ResolvedCard | null> {
    type Row = { card_unique_id: string; pitch: number | null };
    const pitchFilter = l.pitch != null ? sql`AND c.pitch = ${l.pitch}` : sql``;

    const age = l.cardName.match(/\s*\((young|adult)\)\s*$/i);
    const baseName = (age ? l.cardName.slice(0, age.index) : l.cardName).trim().toLowerCase();
    const nameFilter = !age
      ? sql`lower(c.name) = ${baseName}`
      : age[1].toLowerCase() === 'young'
        ? sql`'young' = ANY(c.types) AND lower(c.name) IN (${baseName}, ${baseName.split(',')[0].trim()})`
        : sql`NOT ('young' = ANY(c.types)) AND lower(c.name) = ${baseName}`;

    // No LIMIT: a name maps to at most a few cards (pitches), and the collector
    // number must be able to pick any of them.
    const byName = (await db.execute<Row>(sql`
      SELECT c.card_unique_id, c.pitch FROM cards c
      WHERE ${nameFilter} ${pitchFilter}`)).rows;

    const byCollector = l.collectorNumber
      ? (await db.execute<Row>(sql`
          SELECT DISTINCT c.card_unique_id, c.pitch
          FROM printings p JOIN cards c ON c.card_unique_id = p.card_unique_id
          WHERE upper(p.collector_number) = ${l.collectorNumber} ${pitchFilter}
          LIMIT 2`)).rows
      : [];

    const pick = (rows: Row[]) => (rows.length === 1 ? { cardUniqueId: rows[0].card_unique_id, pitch: rows[0].pitch } : null);
    if (byName.length) {
      // Name is a real card: the collector number only disambiguates it.
      const agreeing = byName.filter((n) => byCollector.some((c) => c.card_unique_id === n.card_unique_id));
      return pick(agreeing.length ? agreeing : byName);
    }
    return pick(byCollector) ?? (await this.looseMatch(l));
  }

  async replaceDay(input: ReplaceMarketFeedDayInput): AsyncResult<MarketFeedReplaceResult> {
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
      const looseMatches: MarketFeedLooseMatch[] = [];
      const suggestions: MarketFeedSuggestion[] = [];
      const rows: (typeof marketFeedListings.$inferInsert)[] = [];
      for (const l of normalized) {
        const match = await this.resolveCard(l);
        if (!match) {
          if (!unmatched.includes(l.cardName)) {
            unmatched.push(l.cardName);
            const s = await this.suggest(l);
            if (s.candidates.length) suggestions.push(s);
          }
        } else if (match.looseName && !looseMatches.some((m) => m.cardName === l.cardName)) {
          looseMatches.push({ cardName: l.cardName, matchedName: match.looseName });
        }
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

      return {
        success: true,
        data: { feedDate: input.feedDate, count: rows.length, unmatched, looseMatches, suggestions },
      };
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
        foiling: string | null; condition: string | null; price: string | null; currency: string;
        group_name: string | null; post_url: string | null; variant: string | null;
        tcg_low: number | null; image_url: string | null;
      }>(sql`
        SELECT l.id, l.side, l.card_name, l.card_unique_id, c.display_name, l.pitch,
               l.collector_number, l.foiling, l.condition, l.price, l.currency, l.group_name, l.post_url, l.variant,
               px.tcg_low, img.image_url
        FROM market_feed_listings l
        LEFT JOIN cards c ON c.card_unique_id = l.card_unique_id
        LEFT JOIN LATERAL (
          SELECT MIN(p.tcg_low) AS tcg_low FROM printings p
          WHERE p.card_unique_id = l.card_unique_id AND p.language = 'en'
            AND (l.foiling IS NULL OR p.foiling = l.foiling)
            AND (l.collector_number IS NULL OR upper(p.collector_number) = l.collector_number)
            AND (l.variant IS NULL
                 OR (l.variant = 'Marvel' AND p.rarity = 'v')
                 OR (l.variant <> 'Marvel' AND ${VARIANT_CODE_SQL} = ANY(p.art_variations)))
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
            price: r.price == null ? null : Number(r.price),
            currency: r.currency,
            groupName: r.group_name,
            postUrl: r.post_url,
            variant: r.variant,
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

  /**
   * The viewer's holdings for the cards in one day's feed: what they own
   * (whole collection; forTradeQuantity = copies marked for trade) and what is
   * on their wants list. Card-level (card_unique_id); foilings let the page
   * flag an exact-foiling match. Only ever called for the signed-in viewer.
   */
  async getViewerMatches(userId: string, feedDate: string): AsyncResult<MarketFeedViewerMatches> {
    try {
      if (!isValidFeedDate(feedDate)) return { success: false, error: 'feedDate must be a YYYY-MM-DD date' };
      // One row per owned inventory line; foilings + variants aggregate below.
      const ownedRows = await db.execute<{
        card_unique_id: string; quantity: number; for_trade: boolean; foiling: string;
        rarity: string | null; art_variations: string[] | null;
      }>(sql`
        SELECT p.card_unique_id, i.quantity, i.for_trade, p.foiling, p.rarity, p.art_variations
        FROM inventory_items i JOIN printings p ON p.printing_id = i.printing_id
        WHERE i.user_id = ${userId} AND i.quantity > 0
          AND p.card_unique_id IN (SELECT card_unique_id FROM market_feed_listings
                                   WHERE feed_date = ${feedDate} AND card_unique_id IS NOT NULL)`);
      const labelForArt = Object.fromEntries(Object.entries(VARIANT_ART_CODES).map(([label, code]) => [code, label]));
      const owned: MarketFeedViewerMatches['owned'] = {};
      for (const r of ownedRows.rows) {
        const o = (owned[r.card_unique_id] ??= { quantity: 0, forTradeQuantity: 0, foilings: [], variants: [] });
        o.quantity += Number(r.quantity);
        if (r.for_trade) o.forTradeQuantity += Number(r.quantity);
        if (!o.foilings.includes(r.foiling)) o.foilings.push(r.foiling);
        const variants = [
          ...(r.rarity === 'v' ? ['Marvel'] : []),
          ...(r.art_variations ?? []).map((c) => labelForArt[c]).filter(Boolean),
        ];
        for (const v of variants) if (!o.variants.includes(v)) o.variants.push(v);
      }
      for (const o of Object.values(owned)) {
        o.foilings.sort();
        o.variants.sort();
      }
      const wanted = await db.execute<{ card_unique_id: string; foilings: string[] }>(sql`
        SELECT p.card_unique_id, array_agg(DISTINCT p.foiling ORDER BY p.foiling) AS foilings
        FROM wants_items w JOIN printings p ON p.printing_id = w.printing_id
        WHERE w.user_id = ${userId}
          AND p.card_unique_id IN (SELECT card_unique_id FROM market_feed_listings
                                   WHERE feed_date = ${feedDate} AND card_unique_id IS NOT NULL)
        GROUP BY p.card_unique_id`);
      return {
        success: true,
        data: {
          owned,
          wanted: Object.fromEntries(wanted.rows.map((r) => [r.card_unique_id, { foilings: r.foilings }])),
        },
      };
    } catch (error) {
      console.error('[market-feed] getViewerMatches failed:', error);
      return { success: false, error: 'Failed to match the feed against your collection' };
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
