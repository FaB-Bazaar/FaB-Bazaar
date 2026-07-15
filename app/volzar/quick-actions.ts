// Quick actions for the Volzar chat: deterministic reads that need zero AI
// tokens. "Buttons for the known, chat for the unknown" — listing binders /
// wants / decks (and drilling into a binder) are direct client-service calls
// rendered as data cards, not LLM tool round-trips (~25k tokens saved each).
//
// Each action also produces a compact `context` string. It is NOT sent
// anywhere when the action runs — it's queued, and attached to the NEXT
// free-text message so follow-ups like "which is worth the most?" work.
//
// SHAPE WARNING: /api/wants and /api/binders/[id]/cards return legacy bodies
// ({success, wantsList} / {success, cards, pagination}) with no `data` key,
// so handleResponse passes the WHOLE body through as `data`. The parsers
// below read the actual wire shapes defensively — do not trust the client
// type annotations here (getUserWants claims WantsListResultDTO; the route
// returns the old WantsList format).

import { bindersClient, wantsClient, decksClient } from '@/lib/client';
import { getCardImageUrl, generateUniqueBinderSlug } from '@/lib/utils';
import { matchesDeckFilter } from '@/lib/deck/deck-filter';
import { deckColorBreakdown, type DeckViewCard } from '@/lib/deck/analytics';

/**
 * A display line. Binder/deck lines carry a drill target (one-click
 * contents); card lines carry a preview (hover shows the card image in the
 * desktop rail).
 */
export interface CardPreview {
  imageUrl: string;
  name: string;
  /** Enables the rail's add-to-binder / add-to-wants actions. */
  printingId?: string;
  /** TCG prices, when the source payload carries them. */
  priceLow?: number;
  priceMarket?: number;
  tcgplayerUrl?: string;
}

export type DrillTarget = { kind: 'binder' | 'deck' | 'deck-compare'; id: string; name: string };

export type CardLine = string | {
  text: string;
  drill?: DrillTarget;
  preview?: CardPreview;
  /** Rendered as the pitch pip icon (public/icons/pitch-N.png) after the text. */
  pitch?: number;
  /** Card-level grouping: total printings this row's representative stands in
   *  for (only set when >1). Rendered as a "+N printings" affordance. */
  printingCount?: number;
};

/** Re-drill handle for a You-vs-deck comparison item (row quick-adds refresh it). */
export type CompareRefresh = { publicId: string; deckName: string };

const FOILING_SHORT: Record<string, string> = { s: 'NF', r: 'RF', c: 'CF', g: 'GF' };

/** " · SET · FOIL" tail for binder / wants lines (edition intentionally omitted). */
function cardMeta(c: { set?: string; foiling?: string; printingDetails?: { set?: string; foiling?: string } }): string {
  const set = (c.set ?? c.printingDetails?.set ?? '').toUpperCase();
  const foil = FOILING_SHORT[(c.foiling ?? c.printingDetails?.foiling ?? '') as string];
  return `${set ? ` · ${set}` : ''}${foil ? ` · ${foil}` : ''}`;
}

/** Pitch (1/2/3) from either the flat field or nested printingDetails. */
function cardPitch(c: { pitch?: number; printingDetails?: { pitch?: number } }): number | undefined {
  const p = c.pitch ?? c.printingDetails?.pitch;
  return typeof p === 'number' && p > 0 ? p : undefined;
}

/**
 * Wants tail: " · PEN123 · FOIL · $price" — collector number (identifies the
 * exact printing better than the bare set), foiling, and the low price.
 */
function wantMeta(c: {
  foiling?: string; collector_number?: string; value?: string | number;
  printingDetails?: { foiling?: string; collector_number?: string; tcg_low?: number; tcg_market?: number };
}): string {
  const num = (c.collector_number ?? c.printingDetails?.collector_number ?? '').toUpperCase();
  const foil = FOILING_SHORT[(c.foiling ?? c.printingDetails?.foiling ?? '') as string];
  const raw = c.printingDetails?.tcg_low ?? c.printingDetails?.tcg_market ?? c.value;
  const price = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) || undefined : undefined;
  return `${num ? ` · ${num}` : ''}${foil ? ` · ${foil}` : ''}${price ? ` · $${price.toFixed(2)}` : ''}`;
}

/** A structured card row — renders as a UI table row and a Discord shorthand line. */
export interface CardRow {
  /** Owned/needed quantity. Absent for search hits (no quantity to show). */
  qty?: number;
  name: string;
  pitch?: number;
  collector?: string;
  foiling?: string;   // code: s/r/c/g
  type?: string;      // type_text_display, e.g. "Generic Instant"
  text?: string;      // card rules text (functional text)
  image?: string;     // thumbnail image url
  price?: number;
  /** Binder-tile price spread (TCGplayer low/mid/high/market) + printing
   *  metadata for the binder-page style tile view. */
  priceLow?: number;
  priceMid?: number;
  priceHigh?: number;
  priceMarket?: number;
  rarity?: string;    // code: c/r/m/l/f/v…
  edition?: string;   // code: a/f/u/n
  extendedArt?: boolean;
  marvel?: boolean;   // rarity 'v'
  forTrade?: boolean;
  priority?: string;
  /** Free-text tail-column note (e.g. archetype adoption "9/10 decks"). */
  note?: string;
  /** Grouped search: how many printings this representative row stands in for. */
  printingCount?: number;
  /** Inventory-item id (binder rows only) — the PATCH/DELETE target for the
   *  row ± quantity buttons; a printing can repeat across conditions. */
  itemId?: string;
  /** Comparison rows: copies still unrecorded (needed − owned). Presence
   *  renders the per-row quick-add buttons (heart → wants, folder → binder). */
  addQty?: number;
  preview: CardPreview;
}

/**
 * The `cards.text` column stores LSS "functional text" — fully lowercased, with
 * {p}/{h}/{r}/{d}/{i} token markup, meant for rules parsing, not display. This
 * makes it read like a real card: sentence-case, and re-capitalize the card's
 * own name where it self-references (the common case). Token markup is left
 * intact for the UI to swap to glyphs. Other proper nouns (heroes, other cards)
 * can't be recovered from lowercase — a cased source would be needed for those.
 */
export function prettifyCardText(text?: string | null, cardName?: string): string | undefined {
  if (!text) return undefined;
  // Capitalize the first letter of the string and the first letter after a
  // sentence terminator (. ! ? :) or an opening double-quote.
  let s = text.replace(/(^|[.!?:]\s+|"\s*)([a-z])/g, (_m, pre: string, ch: string) => pre + ch.toUpperCase());
  // Re-capitalize the card's own name (full display_name + its pre-comma
  // segment, e.g. "Teklovossen, Esteemed Magnate" also matches "teklovossen").
  if (cardName) {
    const names = new Set<string>();
    const full = cardName.trim();
    if (full) names.add(full);
    const preComma = full.split(',')[0].trim();
    if (preComma) names.add(preComma);
    for (const n of names) {
      const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      s = s.replace(new RegExp(`\\b${esc}\\b`, 'gi'), n);
    }
  }
  return s;
}

const FOIL_TAG: Record<string, string> = { r: 'RF', c: 'CF', g: 'GF' }; // s (non-foil) intentionally omitted

/** Discord/trade-post shorthand for one card: "3x EA RF Marvel Card Name". */
export function toShorthand(r: CardRow): string {
  const parts: string[] = [];
  if ((r.qty ?? 1) > 1) parts.push(`${r.qty}x`);
  if (r.extendedArt) parts.push('EA');
  const foil = FOIL_TAG[r.foiling ?? ''];
  if (foil) parts.push(foil);
  if (r.marvel) parts.push('Marvel');
  parts.push(r.name);
  return parts.join(' ');
}

/**
 * Display order for the collapsed-workspace strip view: cluster by pitch color
 * (red 1 → yellow 2 → blue 3, pitchless cards last), then by type line within
 * a color, then name — so the pitch gems and card types read as bands instead
 * of noise. Non-mutating; the table view keeps the source order.
 */
export function sortRowsForStrips(rows: CardRow[]): CardRow[] {
  const pitchRank = (r: CardRow) =>
    typeof r.pitch === 'number' && r.pitch > 0 ? r.pitch : Number.MAX_SAFE_INTEGER;
  return [...rows].sort((a, b) =>
    pitchRank(a) - pitchRank(b)
    || (a.type ?? '').localeCompare(b.type ?? '')
    || a.name.localeCompare(b.name));
}

export interface StripSection {
  title: string;
  count: number;
  rows: CardRow[];
  /** Pitch-color subsection accent (drives the deck-page style colored header). */
  accent?: 'red' | 'yellow' | 'blue';
  /** The UNSPLIT source section title ("Maindeck" for "Maindeck — Red") — what
   *  the ±/swap/move plumbing needs for category + optimistic row matching. */
  sourceTitle: string;
}

export type DeckSectionCategory = 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'benched';

/**
 * Section title → deck API category. Handles the pitch-split subsection
 * titles ("Maindeck — Red") and the Bench display name (category 'benched').
 * Blind lowercasing broke both.
 */
export function deckCategoryFromSection(sectionTitle?: string): DeckSectionCategory {
  const base = (sectionTitle ?? 'maindeck').split(' — ')[0].trim().toLowerCase();
  if (base === 'hero' || base === 'equipment' || base === 'inventory') return base;
  if (base === 'bench' || base === 'benched') return 'benched';
  return 'maindeck';
}

const PITCH_SPLIT: Array<{ pitch: number | null; suffix: string; accent?: StripSection['accent'] }> = [
  { pitch: 1, suffix: ' — Red', accent: 'red' },
  { pitch: 2, suffix: ' — Yellow', accent: 'yellow' },
  { pitch: 3, suffix: ' — Blue', accent: 'blue' },
  { pitch: null, suffix: ' — Colorless' },
];

/**
 * Deck-page style sectioning for the workspace tile view: a section whose rows
 * span more than one pitch color (the maindeck) splits into Red / Yellow /
 * Blue (/ Colorless) subsections, counts = quantity sums; single-color and
 * pitchless sections (Hero, Equipment) pass through. Rows are sorted with
 * sortRowsForStrips either way.
 */
export function splitSectionsByPitch(
  sections: Array<{ title: string; count: number; rows: CardRow[] }>,
): StripSection[] {
  const out: StripSection[] = [];
  for (const sec of sections) {
    const pitchOf = (r: CardRow) => (typeof r.pitch === 'number' && r.pitch > 0 ? r.pitch : null);
    const distinct = new Set(sec.rows.map(pitchOf));
    if (distinct.size <= 1) {
      out.push({ ...sec, rows: sortRowsForStrips(sec.rows), sourceTitle: sec.title });
      continue;
    }
    for (const { pitch, suffix, accent } of PITCH_SPLIT) {
      const rows = sortRowsForStrips(sec.rows.filter((r) => pitchOf(r) === pitch));
      if (rows.length === 0) continue;
      out.push({
        title: `${sec.title}${suffix}`,
        count: rows.reduce((s, r) => s + (r.qty ?? 1), 0),
        rows,
        accent,
        sourceTitle: sec.title,
      });
    }
  }
  return out;
}

/** Build a CardRow from a wants/binder card payload (tolerant of flat + nested shapes). */
function toCardRow(c: any): CardRow {
  const d = c.printingDetails ?? {};
  const name = c.display_name || d.display_name || c.name || 'Unknown card';
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) || undefined : undefined);
  const price = num(d.tcg_low ?? d.tcg_market ?? c.tcg_low ?? c.tcg_market ?? c.value);
  return {
    qty: c.quantity ?? 1,
    name,
    pitch: cardPitch(c),
    collector: (c.collector_number ?? d.collector_number ?? '').toUpperCase() || undefined,
    foiling: c.foiling ?? d.foiling ?? undefined,
    type: c.type_text_display ?? d.type_text_display ?? undefined,
    text: prettifyCardText(c.card_text ?? d.card_text ?? c.text ?? d.text, name),
    image: c.image_url ?? d.image_url ?? c.image ?? d.image ?? undefined,
    price,
    priceLow: num(c.tcg_low ?? d.tcg_low),
    priceMid: num(c.tcg_mid ?? d.tcg_mid),
    priceHigh: num(c.tcg_high ?? d.tcg_high),
    priceMarket: num(c.tcg_market ?? d.tcg_market),
    rarity: c.rarity ?? d.rarity ?? undefined,
    edition: c.edition ?? d.edition ?? undefined,
    extendedArt: !!(c.is_extended_art ?? d.is_extended_art),
    marvel: (c.rarity ?? d.rarity) === 'v',
    forTrade: c.forTrade ?? undefined,
    priority: c.priority ?? undefined,
    itemId: c.id ?? c._id ?? undefined,
    preview: toCardPreview(c, name),
  };
}

/** Extracts a rail preview from any of the card payload shapes we render. */
export function toCardPreview(card: any, name: string): CardPreview {
  const details = card?.printingDetails ?? {};
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) || undefined : undefined);
  return {
    imageUrl: getCardImageUrl(card),
    name,
    printingId: card?.printingId || details.printing_id || undefined,
    priceLow: num(details.tcg_low ?? card?.tcg_low),
    priceMarket: num(details.tcg_market ?? card?.tcg_market ?? card?.value),
    tcgplayerUrl: details.tcgplayer_url ?? card?.tcgplayer_url ?? undefined,
  };
}

/** A selectable printing in the rail's "swap printing" picker. */
export interface SwapPrintingOption {
  printingId: string;
  set: string;
  foiling?: string;
  rarity?: string;
  edition?: string;
  collector?: string;
  isExtendedArt: boolean;
  priceLow?: number;
  priceMarket?: number;
  imageUrl: string;
  /** The full rail preview this option swaps to (image, prices, TCG link, add actions). */
  preview: CardPreview;
}

/**
 * Map a `/api/search/core` printing row (snake_case DTO) to a swap option and
 * its full rail preview — so choosing a different printing refreshes the image,
 * prices, TCGplayer link, and the printingId the add-to-wants/binder actions use.
 */
export function printingToSwapOption(p: any, name: string): SwapPrintingOption {
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) || undefined : undefined);
  const printingId = p?.printing_id;
  const priceLow = num(p?.tcg_low);
  const priceMarket = num(p?.tcg_market);
  const imageUrl = getCardImageUrl({ image_url: p?.image_url, printingId });
  return {
    printingId,
    set: p?.set ?? '',
    foiling: p?.foiling ?? undefined,
    rarity: p?.rarity ?? undefined,
    edition: p?.edition ?? undefined,
    collector: p?.collector_number ?? undefined,
    isExtendedArt: !!p?.is_extended_art,
    priceLow,
    priceMarket,
    imageUrl,
    preview: {
      imageUrl,
      name,
      printingId,
      priceLow,
      priceMarket,
      tcgplayerUrl: p?.tcgplayer_url ?? undefined,
    },
  };
}

export interface QuickActionResult {
  title: string;
  lines: CardLine[];
  /** Compact representation queued as context for the next AI turn. */
  context: string;
  /** Cards for the "View as cards" grid overlay (deck drills + consensus). */
  cards?: DeckViewCard[];
  /** Overlay subtitle clarifying what the card grid represents (e.g. "missing"). */
  cardsSubtitle?: string;
  /** Structured rows → a scannable UI table + Discord copy (wants / binder). */
  tableRows?: CardRow[];
  /** Section-grouped rows → the same striped card table, split into subheaded
   *  groups (deck drills: Hero / Equipment / Maindeck). */
  tableSections?: Array<{ title: string; count: number; rows: CardRow[] }>;
  /** Column header for the table's tail note column (e.g. "Decks" for the
   *  archetype adoption ratio). Only used when rows carry `note`. */
  tableNoteHeader?: string;
  /** Copy header line (e.g. "Wants:" / binder name) for the Discord copy. */
  copyHeader?: string;
  /** Deck drill stat chips (maindeck colors + type buckets + cost curve). */
  deckStats?: DeckStats;
  /** Deck dashboard: the collection-compare drill behind "Check what I own". */
  compareDrill?: DrillTarget;
  /** Public id of the deck this card represents — enables the deterministic
   *  "Add to my decks" button (a session-auth copy, no AI). Deck drills only. */
  publicId?: string;
  /** True only when the deck API said canEdit (owner/co-owner) — gates the
   *  "Add card" button so it never shows on Decks to Beat / others' decks. */
  deckEditable?: boolean;
  /** Where the row ± quantity buttons write. Absent → read-only table. */
  mutate?: RowMutation;
  /** Cross-deck game results → a table (Game results action). */
  resultRows?: GameResultRow[];
  /** Curated deck printings the user still needs (missing + partial shortfall),
   *  ready for a one-click, no-AI `wantsClient.bulkAddWants`. Comparison card only. */
  wantsAdd?: Array<{ printingId: string; quantity: number; priority: 'high' | 'medium' | 'low' }>;
  /** Comparison card only: how to re-drill this item after a row quick-add
   *  writes (the row must visibly migrate out of Missing). */
  compareRefresh?: CompareRefresh;
}

/** API game payload → the GameResultRow shape analyzeGame consumes. */
export function toGameResultRows(results: Array<{
  id: string;
  deckPublicId?: string;
  deckName?: string;
  format?: string | null;
  playerHero?: string | null;
  opponentHero?: string | null;
  result?: 'win' | 'loss';
  playedAt?: string | Date | null;
}>): GameResultRow[] {
  const dateLabel = (d?: string | Date | null) =>
    d ? String(typeof d === 'string' ? d : d.toISOString()).slice(0, 10) : '';
  return results.map((r) => ({
    deckName: r.deckName ?? 'Unknown deck',
    deckPublicId: r.deckPublicId,
    resultId: r.id,
    playerHero: heroLabel(r.playerHero),
    opponentHero: heroLabel(r.opponentHero),
    result: r.result === 'win' ? 'win' : 'loss',
    date: dateLabel(r.playedAt),
    ...(r.format ? { format: r.format } : {}),
  }));
}

/**
 * The deck card's "Review latest Talishar game": newest recorded game for
 * THIS deck (the /recent feed is newest-first), ready for analyzeGame.
 * null = no games recorded for the deck.
 */
export async function fetchLatestGameForDeck(deckPublicId: string): Promise<GameResultRow | null> {
  const response = await fetch('/api/results/recent?limit=50', { credentials: 'include' });
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Could not load game results');
  const games = (data.data ?? []).filter((g: any) => g.deckPublicId === deckPublicId);
  if (games.length === 0) return null;
  return toGameResultRows(games)[0];
}

/**
 * Rail "Game results" badge: total games on UNFLAGGED personal decks only —
 * a superadmin owns the Decks to Beat system decks, and their games must not
 * inflate the personal count.
 */
export function sumPersonalGames(
  perf: Array<{ deckPublicId?: string; games?: number }>,
  personalDeckIds: Set<string>,
): number {
  return perf.reduce((sum, row) =>
    row.deckPublicId && personalDeckIds.has(row.deckPublicId) ? sum + (row.games ?? 0) : sum, 0);
}

/** One recorded game for the Game-results table. resultId + deckName let the
 *  model analyze it via get_results. */
export interface GameResultRow {
  deckName: string;
  deckPublicId?: string;
  resultId: string;
  playerHero: string;
  opponentHero: string;
  result: 'win' | 'loss';
  /** YYYY-MM-DD. */
  date: string;
  format?: string;
}

export interface QuickAction {
  id: string;
  label: string;
  run: () => Promise<QuickActionResult>;
}

// ---------------------------------------------------------------------------
// Pure formatters (unit-tested)
// ---------------------------------------------------------------------------

export function summarizeBinders(
  binders: Array<{ _id: string; name: string; slug?: string | null }>,
): QuickActionResult {
  const lines: CardLine[] = binders.length === 0
    ? ['No binders yet.']
    : binders.map((b) => ({
        text: b.slug ? `${b.name} (${b.slug})` : b.name,
        drill: { kind: 'binder' as const, id: b._id, name: b.name },
      }));
  return {
    title: `Your binders (${binders.length})`,
    lines,
    context: `The user's binders (name, slug): ${binders.map((b) => `${b.name}${b.slug ? ` [${b.slug}]` : ''}`).join('; ') || 'none'}`,
  };
}

export function summarizeWantsCards(
  cards: Array<{ display_name?: string; name?: string; quantity?: number; priority?: string; foiling?: string; pitch?: number; collector_number?: string; rarity?: string; is_extended_art?: boolean; value?: string | number; printingDetails?: { display_name?: string; foiling?: string; pitch?: number; collector_number?: string; tcg_low?: number; tcg_market?: number } }>,
): QuickActionResult {
  // /api/wants exposes display_name only inside printingDetails; the top-level
  // `name` is the lowercase internal name — so read the proper name first.
  const label = (c: { display_name?: string; name?: string; printingDetails?: { display_name?: string } }) =>
    c.display_name || c.printingDetails?.display_name || c.name || 'Unknown card';
  const lines: CardLine[] = cards.length === 0
    ? ['Your wants list is empty.']
    : cards.map((c) => ({
        text: `${c.quantity ?? 1}× ${label(c)}${wantMeta(c)}${c.priority ? ` (${c.priority})` : ''}`,
        pitch: cardPitch(c),
        preview: toCardPreview(c, label(c)),
      }));
  return {
    title: `Your wants (${cards.length})`,
    lines,
    context: `The user's wants list (qty× name, priority): ${
      cards.map((c) => `${c.quantity ?? 1}× ${label(c)}${c.priority ? ` (${c.priority})` : ''}`).join('; ') || 'empty'
    }`,
    // Rows drop type/rules text on purpose: next to the workspace rail the
    // TYPE column wrapped char-by-char; detail lives on hover + Present.
    ...(cards.length ? {
      tableRows: cards.map((c) => { const { type: _type, text: _text, ...row } = toCardRow(c); return row; }),
      copyHeader: 'Wants:',
      mutate: { kind: 'wants' as const },
    } : {}),
  };
}

export function summarizeDecks(
  allDecks: Array<{ publicId?: string; name: string; format?: string; heroDisplayName?: string; heroName?: string; isSystemDeck?: boolean; featured?: boolean }>,
): QuickActionResult {
  // "My decks" is the personal view. For a curator/superadmin, GET /api/decks
  // includes their reference decks — both `featured` (Decks to Beat) and
  // `isSystemDeck` (System Deck) — which have their own retrieval. Reuse the
  // /decks page's "personal" bucket (not featured, not system) so both surfaces
  // agree. Both flags ride the DeckSummaryDTO.
  const decks = allDecks.filter((d) => matchesDeckFilter(d, 'all'));
  // /api/decks carries lowercase heroName; heroDisplayName only sometimes.
  const hero = (d: { heroDisplayName?: string; heroName?: string }) => d.heroDisplayName || d.heroName;
  const describe = (d: { name: string; format?: string; heroDisplayName?: string; heroName?: string }) =>
    `${d.name}${hero(d) ? ` — ${hero(d)}` : ''}${d.format ? ` (${d.format})` : ''}`;
  const lines: CardLine[] = decks.length === 0
    ? ['No decks yet.']
    : decks.map((d) => d.publicId
        ? { text: describe(d), drill: { kind: 'deck' as const, id: d.publicId, name: d.name } }
        : describe(d));
  return {
    title: `Your decks (${decks.length})`,
    lines,
    context: `The user's decks (name — hero, format): ${decks.map(describe).join('; ') || 'none'}`,
  };
}

interface DeckCard {
  quantity?: number;
  printingId?: string;
  printingDetails?: { display_name?: string; name?: string; pitch?: number; image_url?: string; printing_id?: string };
}

/** Map a deck card (drill shape) to the overlay's DeckViewCard. */
function toDeckViewCard(c: DeckCard): DeckViewCard {
  const name = c.printingDetails?.display_name || c.printingDetails?.name || 'Unknown card';
  return {
    printingId: c.printingId || c.printingDetails?.printing_id,
    name,
    quantity: c.quantity ?? 1,
    pitch: c.printingDetails?.pitch,
    imageUrl: getCardImageUrl(c),
  };
}

/**
 * The df.describe() of a decklist — an instant, no-AI plain-english shape
 * line shown the moment a deck opens: qty-weighted type buckets (from the
 * type line's tail, e.g. "…Action - Attack" → Attack), then the cost curve.
 * Returns '' when there's nothing to summarize.
 */
export function deckShapeSummary(maindeck: DeckCard[]): string {
  const stats = deckShapeStats(maindeck);
  if (!stats) return '';
  const parts: string[] = stats.buckets.map((b) => `${b.qty}× ${b.label}`);
  if (stats.moreBuckets) parts.push(`+ ${stats.moreBuckets} more`);
  if (typeof stats.avgCost === 'number') {
    parts.push(`avg cost ${stats.avgCost.toFixed(1)}`);
    if (stats.zeroCost) parts.push(`${stats.zeroCost} zero-cost`);
  }
  return parts.length ? `📊 ${parts.join(' · ')}` : '';
}

/** Deck drill stat chips — the structured twin of deckShapeSummary (+ colors). */
export interface DeckStats {
  colors?: { red: number; yellow: number; blue: number };
  buckets: Array<{ label: string; qty: number }>;
  moreBuckets?: number;
  avgCost?: number;
  zeroCost?: number;
}

/** The numbers behind deckShapeSummary, for the UI's chip renderer. */
export function deckShapeStats(maindeck: DeckCard[]): Omit<DeckStats, 'colors'> | null {
  if (maindeck.length === 0) return null;
  const buckets = new Map<string, number>();
  let costQty = 0, costSum = 0, zeroCost = 0;
  for (const c of maindeck) {
    const qty = c.quantity ?? 1;
    const pd = c.printingDetails as Record<string, unknown> | undefined;
    const typeText = typeof pd?.type_text_display === 'string' ? pd.type_text_display : '';
    // "Mechanologist Action - Attack" → "Attack"; "Generic Instant" → "Instant"
    const tail = typeText.includes(' - ')
      ? typeText.split(' - ').pop()!.trim()
      : typeText.split(' ').pop()?.trim() || '';
    if (tail) buckets.set(tail, (buckets.get(tail) ?? 0) + qty);
    const cost = pd?.cost;
    if (typeof cost === 'number') {
      costQty += qty;
      costSum += cost * qty;
      if (cost === 0) zeroCost += qty;
    }
  }
  const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
  const MAX_BUCKETS = 6;
  if (sorted.length === 0 && costQty === 0) return null;
  return {
    buckets: sorted.slice(0, MAX_BUCKETS).map(([label, qty]) => ({ label, qty })),
    ...(sorted.length > MAX_BUCKETS ? { moreBuckets: sorted.length - MAX_BUCKETS } : {}),
    ...(costQty > 0 ? { avgCost: costSum / costQty } : {}),
    ...(costQty > 0 && zeroCost > 0 ? { zeroCost } : {}),
  };
}

export function summarizeDeckContents(deck: {
  publicId?: string;
  name: string;
  format?: string;
  heroName?: string;
  canEdit?: boolean;
  hero?: DeckCard[];
  equipment?: DeckCard[];
  maindeck?: DeckCard[];
  inventory?: DeckCard[];
  benched?: DeckCard[];
}): QuickActionResult {
  const label = (c: DeckCard) => c.printingDetails?.display_name || c.printingDetails?.name || 'Unknown card';
  const cardLine = (c: DeckCard): CardLine => ({
    text: `${c.quantity ?? 1}× ${label(c)}`,
    pitch: c.printingDetails?.pitch,
    preview: toCardPreview(c, label(c)),
  });
  // Context lines carry pitch + cost + the printed type line, so "describe
  // this deck" answers classify from DATA instead of the model's memory (it
  // once bucketed Sink Below, a defense reaction, under attacks). The hero's
  // rules text rides along too — game-plan answers hinge on it.
  const contextLine = (c: DeckCard, withText = false) => {
    const pd = c.printingDetails as Record<string, unknown> | undefined;
    const parts = [
      pd?.pitch ? `p${pd.pitch}` : null,
      typeof pd?.cost === 'number' ? `cost ${pd.cost}` : null,
      typeof pd?.type_text_display === 'string' && pd.type_text_display ? pd.type_text_display : null,
    ].filter(Boolean);
    const text = withText && typeof pd?.text === 'string' && pd.text ? ` — ability: "${pd.text}"` : '';
    return `${c.quantity ?? 1}x ${label(c)}${parts.length ? ` (${parts.join(', ')})` : ''}${text}`;
  };

  const sections: Array<[string, DeckCard[]]> = [
    ['Hero', deck.hero ?? []],
    ['Equipment', deck.equipment ?? []],
    ['Maindeck', deck.maindeck ?? []],
    // Sideboard cards — matchup side-ins come from here, so the decklist table
    // (and the swap-row thumbnail lookup built from it) must include them.
    ['Inventory', deck.inventory ?? []],
    // Benched cards are part of the deck — without this section, "move to
    // bench" from the tile menu would make a card silently vanish.
    ['Bench', deck.benched ?? []],
  ];

  const lines: CardLine[] = [];
  const contextParts: string[] = [];
  for (const [sectionName, cards] of sections) {
    if (cards.length === 0) continue;
    const total = cards.reduce((sum, c) => sum + (c.quantity ?? 1), 0);
    lines.push(`— ${sectionName} (${total}) —`);
    lines.push(...cards.map(cardLine));
    const withText = sectionName === 'Hero'; // hero ability text only — ~50 tokens, not 70 cards' worth
    contextParts.push(`${sectionName}: ${cards.map((c) => contextLine(c, withText)).join(', ')}`);
  }
  // Instant, no-AI color breakdown of the maindeck — answers "how many blue
  // cards" the moment you open a deck, computed from pitch (not the LLM).
  let colorSummary = '';
  const colors = deckColorBreakdown(deck.maindeck ?? []);
  if (colors.red + colors.yellow + colors.blue > 0) {
    colorSummary = `🎨 Maindeck colors: ${colors.red} red · ${colors.yellow} yellow · ${colors.blue} blue`;
  }

  // Instant df.describe()-style shape line — type buckets + cost curve.
  const shapeSummary = deckShapeSummary(deck.maindeck ?? []);

  if (lines.length === 0) lines.push('This deck is empty.');

  // Structured chips for the UI (the emoji strings above stay context-only —
  // the run-on text lines read badly in the card).
  const shapeStats = deckShapeStats(deck.maindeck ?? []);
  const hasColors = colors.red + colors.yellow + colors.blue > 0;
  const deckStats: DeckStats | undefined = hasColors || shapeStats
    ? { ...(hasColors ? { colors } : {}), buckets: [], ...shapeStats }
    : undefined;

  const viewCards = [...(deck.hero ?? []), ...(deck.equipment ?? []), ...(deck.maindeck ?? [])].map(toDeckViewCard);

  // Section-grouped rows for the striped card table (same renderer as binder /
  // wants). Mirrors the `lines` sections; the UI shows this table and filters
  // the now-redundant card/header lines, keeping only the color + compare rows.
  const tableSections = sections
    .filter(([, cards]) => cards.length > 0)
    .map(([sectionName, cards]) => ({
      title: sectionName,
      count: cards.reduce((sum, c) => sum + (c.quantity ?? 1), 0),
      rows: cards.map(toCardRow),
    }));

  return {
    title: `Deck: ${deck.name}${deck.format ? ` (${deck.format})` : ''}`,
    lines,
    context: `The user's deck "${deck.name}"${deck.heroName ? `, hero ${deck.heroName}` : ''}${deck.format ? `, format ${deck.format}` : ''}. ${colorSummary ? `Maindeck colors: ${colors.red} red / ${colors.yellow} yellow / ${colors.blue} blue. ` : ''}${shapeSummary ? `Maindeck shape: ${shapeSummary.replace('📊 ', '')}. ` : ''}${contextParts.join('. ') || 'Empty deck.'}`,
    ...(viewCards.length ? { cards: viewCards, cardsSubtitle: 'Full decklist' } : {}),
    ...(tableSections.length ? { tableSections } : {}),
    ...(deckStats ? { deckStats } : {}),
    // Dashboard "Check what I own" action (was a lines drill-link).
    ...(deck.publicId && lines.length && tableSections.length
      ? { compareDrill: { kind: 'deck-compare' as const, id: deck.publicId, name: deck.name } }
      : {}),
    ...(deck.publicId ? { publicId: deck.publicId } : {}),
    ...(deck.publicId && deck.canEdit
      ? { deckEditable: true, mutate: { kind: 'deck' as const, publicId: deck.publicId } }
      : {}),
  };
}

/** Slug hero (dash_io / kassai_of_the_golden_sand) → "Dash Io" / "Kassai Of The Golden Sand". */
function heroLabel(slug?: string | null): string {
  if (!slug) return 'Unknown';
  return slug.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Cross-deck game-results table (the "Game results" action). Each row carries
 * the deckName + resultId so the model can analyze a game via get_results. The
 * queued context lists the same games compactly so "analyze game 2" resolves.
 */
export function summarizeGameResults(
  results: Array<{
    id: string;
    deckPublicId?: string;
    deckName?: string;
    format?: string | null;
    playerHero?: string | null;
    opponentHero?: string | null;
    result?: 'win' | 'loss';
    playedAt?: string | Date | null;
  }>,
): QuickActionResult {
  const rows = toGameResultRows(results);

  const lines: CardLine[] = rows.length === 0
    ? ['No recorded games yet.']
    : [`${rows.length} recent game${rows.length === 1 ? '' : 's'} (newest first). Click Analyze on a game for a breakdown.`];

  const context = rows.length === 0
    ? 'The user has no recorded game results.'
    : `The user's recent games (newest first): ${rows
        .map((r, i) => `${i + 1}. "${r.deckName}" (${r.playerHero}) vs ${r.opponentHero} — ${r.result.toUpperCase()}${r.date ? ` on ${r.date}` : ''} [deckName "${r.deckName}", resultId ${r.resultId}]`)
        .join('; ')}. To analyze a game, call get_results with its deckName and resultId.`;

  return {
    title: 'Game results',
    lines,
    context,
    ...(rows.length ? { resultRows: rows } : {}),
  };
}

/**
 * One-click game analysis: build the chat turn the Analyze button sends on the
 * user's behalf. `display` is the short human line shown as the user's bubble;
 * `content` is what actually goes to the model — with deckName + resultId
 * baked in so get_results fetches exactly this game (no "game 2" ambiguity).
 */
export function buildAnalyzeGameMessage(row: GameResultRow): { display: string; content: string } {
  const matchup = `"${row.deckName}" (${row.playerHero}) vs ${row.opponentHero}`;
  const when = row.date ? ` on ${row.date}` : '';
  return {
    display: `Analyze my game: ${matchup}${when}`,
    content: [
      `Analyze one of my recorded games: ${matchup}${when} — a ${row.result.toUpperCase()}${row.format ? ` (format ${row.format})` : ''}.`,
      `Call get_results with deckName "${row.deckName}" and resultId "${row.resultId}" to fetch it,`,
      `then give me a coaching breakdown: the key turning points, any misplays or better lines, and one thing to practice.`,
    ].join(' '),
  };
}

/** One list of a hero's curated kit, as GET /api/curated-lists?heroName= returns it. */
export interface HeroKitList {
  name: string;
  format?: string | null;
  cards?: Array<{
    displayName?: string;
    printingId: string;
    pitch?: number;
    typeTextDisplay?: string;
    text?: string;
    imageUrl?: string;
    collectorNumber?: string;
    foiling?: string;
    tcgLow?: number;
    tcgMarket?: number;
    tcgplayerUrl?: string;
  }>;
}

const KIT_TEXT_MAX = 180;

/**
 * Deterministic hero kit card ("Hero kit" instant action): the hero's
 * published curated lists for one format, rendered as sectioned card lines —
 * and queued as context carrying each card's TYPE and RULES TEXT, so a
 * follow-up like "what should I build around?" is answered from context by
 * any model, with zero tool-call planning required.
 */
export function summarizeHeroKit(displayName: string, format: string, lists: HeroKitList[]): QuickActionResult {
  const matching = lists.filter(
    (l) => (l.format ?? '').toLowerCase() === format.toLowerCase() && (l.cards?.length ?? 0) > 0,
  );
  const title = `Kit: ${displayName} (${format})`;
  if (matching.length === 0) {
    return {
      title,
      lines: [`No published kit lists for ${displayName} in ${format}.`],
      context: `No published curated kit for ${displayName} in ${format}.`,
    };
  }

  const preview = (c: NonNullable<HeroKitList['cards']>[number], name: string): CardPreview => ({
    imageUrl: c.imageUrl || getCardImageUrl({ printingId: c.printingId }),
    name,
    printingId: c.printingId,
    priceLow: c.tcgLow,
    priceMarket: c.tcgMarket,
    tcgplayerUrl: c.tcgplayerUrl,
  });

  const lines: CardLine[] = [];
  const contextParts: string[] = [];
  const viewCards: DeckViewCard[] = [];
  // Section-grouped striped table — the same renderer deck drills and binders
  // use, so the kit reads consistently (thumbnail, type, rules text, price).
  const tableSections: Array<{ title: string; count: number; rows: CardRow[] }> = [];
  for (const list of matching) {
    const cards = list.cards!;
    lines.push(`— ${list.name} (${cards.length}) —`);
    const ctxCards: string[] = [];
    const rows: CardRow[] = [];
    for (const c of cards) {
      const name = c.displayName || 'Unknown card';
      const pitch = typeof c.pitch === 'number' && c.pitch > 0 ? c.pitch : undefined;
      lines.push({
        text: `${name}${c.typeTextDisplay ? ` — ${c.typeTextDisplay}` : ''}`,
        pitch,
        preview: preview(c, name),
      });
      rows.push({
        qty: 1,
        name,
        pitch,
        collector: c.collectorNumber?.toUpperCase() || undefined,
        foiling: c.foiling || undefined,
        type: c.typeTextDisplay || undefined,
        text: prettifyCardText(c.text, name),
        image: c.imageUrl || getCardImageUrl({ printingId: c.printingId }),
        price: c.tcgLow ?? c.tcgMarket,
        preview: preview(c, name),
      });
      viewCards.push({
        printingId: c.printingId,
        name,
        quantity: 1,
        pitch: c.pitch,
        imageUrl: c.imageUrl || getCardImageUrl({ printingId: c.printingId }),
      });
      const text = (c.text ?? '').replace(/\s+/g, ' ').trim();
      ctxCards.push(
        `${name} [${c.typeTextDisplay ?? 'card'}${c.pitch ? `, pitch ${c.pitch}` : ''}]`
        + (text ? `: "${text.length > KIT_TEXT_MAX ? `${text.slice(0, KIT_TEXT_MAX)}…` : text}"` : ''),
      );
    }
    tableSections.push({ title: list.name, count: cards.length, rows });
    contextParts.push(`${list.name}: ${ctxCards.join('; ')}`);
  }

  return {
    title,
    lines,
    context: `Curated kit pool for ${displayName} (${format}) — the curator's real, legal cards to build a deck from, with each card's type and rules text. ${contextParts.join('. ')}`,
    cards: viewCards,
    cardsSubtitle: `Curated kit pool — ${viewCards.length} cards`,
    tableSections,
  };
}

export function summarizeBinderCards(
  binderName: string,
  cards: Array<{ display_name?: string; name?: string; quantity?: number; forTrade?: boolean; set?: string; foiling?: string; pitch?: number; collector_number?: string; rarity?: string; is_extended_art?: boolean; printingDetails?: { set?: string; foiling?: string; pitch?: number } }>,
  totalQuantity?: number,
  binderId?: string,
): QuickActionResult {
  const label = (c: { display_name?: string; name?: string }) => c.display_name || c.name || 'Unknown card';
  const lines: CardLine[] = cards.length === 0
    ? ['This binder is empty.']
    : cards.map((c) => ({
        text: `${c.quantity ?? 1}× ${label(c)}${cardMeta(c)}${c.forTrade ? ' · for trade' : ''}`,
        pitch: cardPitch(c),
        preview: toCardPreview(c, label(c)),
      }));
  if (totalQuantity !== undefined && cards.length > 0) {
    lines.push(`Total: ${totalQuantity} cards`);
  }
  return {
    title: `Binder: ${binderName}`,
    lines,
    context: `Contents of the user's binder "${binderName}" (qty× name): ${
      cards.map((c) => `${c.quantity ?? 1}× ${label(c)}${c.forTrade ? ' [for trade]' : ''}`).join('; ') || 'empty'
    }`,
    ...(cards.length ? { tableRows: cards.map(toCardRow), copyHeader: `${binderName}:` } : {}),
    ...(binderId ? { mutate: { kind: 'binder' as const, binderId } } : {}),
  };
}

export interface SearchResultsCard {
  tableRows: CardRow[];
  total: number;
  shown: number;
}

/** 'generic' / ['generic','action'] → "Generic Action" — a readable type line. */
function typesLabel(types: unknown): string | undefined {
  if (!Array.isArray(types) || types.length === 0) return undefined;
  return types.map((t) => String(t).charAt(0).toUpperCase() + String(t).slice(1)).join(' ');
}

/**
 * Parses search_printings structuredContent (the token-bypass channel) into
 * the same CardRow table rows binder/deck cards render — consistent UI. The
 * full projected printing list already arrives in the browser with every AI
 * search; rows feed the rail (hover preview + add-to-binder/wants via
 * printing_id). No qty — search hits carry no owned quantity.
 */
export function parseSearchResults(structured: any, maxRows = 20): SearchResultsCard | null {
  const first = structured?.results?.[0];
  if (!first || !Array.isArray(first.printings) || first.printings.length === 0) return null;

  const tableRows: CardRow[] = first.printings.slice(0, maxRows).map((p: any) => {
    const name = p.name || 'Unknown card';
    return {
      name,
      pitch: typeof p.pitch === 'number' ? p.pitch : undefined,
      collector: (p.collector_number ?? '').toUpperCase() || undefined,
      foiling: p.foiling || undefined,
      type: typesLabel(p.types),
      text: prettifyCardText(p.text, name),
      image: p.image_url || getCardImageUrl({ printingId: p.printing_id }),
      price: typeof p.price === 'number' ? p.price : undefined,
      ...(typeof p.printing_count === 'number' && p.printing_count > 1 ? { printingCount: p.printing_count } : {}),
      preview: {
        imageUrl: p.image_url || getCardImageUrl({ printingId: p.printing_id }),
        name,
        printingId: p.printing_id,
        priceLow: typeof p.price === 'number' ? p.price : undefined,
        tcgplayerUrl: p.tcgplayer_url || undefined,
      },
    };
  });

  return { tableRows, total: first.total ?? first.printings.length, shown: tableRows.length };
}

/**
 * One consensus card. The card-intrinsic attributes (type/cost/power/defense/
 * text) ride along so `context` can self-describe every core+flex card — the
 * model only sees `context`, never the rendered table, and without these it
 * invents card roles on follow-up questions.
 */
export interface ConsensusCardDetail {
  name: string;
  pitch?: number;
  decks: number;
  typicalQty: number;
  printingId?: string;
  typeText?: string;
  cost?: number;
  power?: number;
  defense?: number;
  text?: string;
}

/** Shape returned by GET /api/decks/archetype (deterministic, no AI). */
export interface ArchetypeConsensusData {
  heroName: string;
  format?: string | null;
  months: number;
  consensus: {
    deckCount: number;
    core: ConsensusCardDetail[];
    flex: ConsensusCardDetail[];
    colorCurve: { red: number; yellow: number; blue: number };
  };
  decks: Array<{ publicId: string; name: string; placing?: number | null; eventName?: string | null }>;
}

/**
 * Render the cross-deck archetype consensus as instant, no-AI result lines:
 * the color curve, the core (unanimous) cards, and the flex cards with their
 * adoption ratio — the deterministic version of "compare these decks".
 */
export function summarizeArchetypeConsensus(data: ArchetypeConsensusData): QuickActionResult {
  const { consensus: c, heroName, months } = data;
  const title = `${heroName} — consensus of ${c.deckCount} deck${c.deckCount !== 1 ? 's' : ''} (last ${months} mo)`;

  if (c.deckCount === 0) {
    return {
      title,
      lines: [`No featured "Decks to Beat" found for ${heroName} in the last ${months} months.`],
      context: `No featured decks for ${heroName} in the last ${months} months.`,
    };
  }

  const cardLine = (card: ConsensusCardDetail, showRatio: boolean): CardLine => ({
    text: `${card.typicalQty}× ${card.name}${showRatio ? ` — ${card.decks}/${c.deckCount} decks` : ''}`,
    pitch: card.pitch && card.pitch > 0 ? card.pitch : undefined,
    // Rail hover preview from the representative printing (like the wants/deck lists).
    ...(card.printingId
      ? { preview: { imageUrl: getCardImageUrl({ printingId: card.printingId }), name: card.name, printingId: card.printingId } }
      : {}),
  });

  const lines: CardLine[] = [
    `🎨 Avg colors: ${c.colorCurve.red} red · ${c.colorCurve.yellow} yellow · ${c.colorCurve.blue} blue`,
  ];
  if (c.core.length) {
    lines.push(`— Core (${c.core.length}) · in all ${c.deckCount} decks —`);
    lines.push(...c.core.map((card) => cardLine(card, false)));
  }
  if (c.flex.length) {
    lines.push(`— Flex (${c.flex.length}) · varies by build —`);
    lines.push(...c.flex.map((card) => cardLine(card, true)));
  }

  // The same striped card table deck drills / kits render — Core and Flex as
  // sections, with the adoption ratio riding the tail "Decks" column on flex.
  const toRow = (card: ConsensusCardDetail, note?: string): CardRow => ({
    qty: card.typicalQty,
    name: card.name,
    pitch: card.pitch && card.pitch > 0 ? card.pitch : undefined,
    image: card.printingId ? getCardImageUrl({ printingId: card.printingId }) : undefined,
    ...(note ? { note } : {}),
    preview: {
      // getCardImageUrl falls back to the cardback for a missing printingId.
      imageUrl: getCardImageUrl({ printingId: card.printingId }),
      name: card.name,
      printingId: card.printingId,
    },
  });
  const tableSections: Array<{ title: string; count: number; rows: CardRow[] }> = [];
  if (c.core.length) {
    tableSections.push({
      title: `Core — in all ${c.deckCount} decks`,
      count: c.core.length,
      rows: c.core.map((card) => toRow(card)),
    });
  }
  if (c.flex.length) {
    tableSections.push({
      title: 'Flex — varies by build',
      count: c.flex.length,
      rows: c.flex.map((card) => toRow(card, `${card.decks}/${c.deckCount} decks`)),
    });
  }

  // The model only ever sees `context`, never the rendered table. Each card
  // self-describes — pitch, cost, power/defense, printed type line, and rules
  // text — so follow-up questions ("why run X", "what's the game plan") answer
  // from DATA instead of the model's memory (it once bucketed Sink Below, a
  // defense reaction, under attacks). NO flex truncation: the divergence
  // between builds is the whole point, and a dropped flex card is the exact
  // gap that made follow-ups hallucinate.
  const contextLine = (card: ConsensusCardDetail, ratio: boolean): string => {
    const attrs = [
      card.pitch && card.pitch > 0 ? `p${card.pitch}` : null,
      typeof card.cost === 'number' ? `cost ${card.cost}` : null,
      typeof card.power === 'number' ? `${card.power}p` : null,
      typeof card.defense === 'number' ? `${card.defense}d` : null,
      card.typeText || null,
    ].filter(Boolean);
    const ability = card.text ? ` — text: "${card.text}"` : '';
    const adoption = ratio ? ` [${card.decks}/${c.deckCount} decks]` : '';
    return `${card.typicalQty}x ${card.name}${attrs.length ? ` (${attrs.join(', ')})` : ''}${adoption}${ability}`;
  };
  const viewCards: DeckViewCard[] = [...c.core, ...c.flex].map((card) => ({
    printingId: card.printingId,
    name: card.name,
    quantity: card.typicalQty,
    pitch: card.pitch,
    imageUrl: card.printingId ? getCardImageUrl({ printingId: card.printingId }) : undefined,
  }));
  return {
    title,
    lines,
    context: `Deterministic consensus across ${c.deckCount} featured ${heroName} decks (last ${months} mo). `
      + `Core (in all ${c.deckCount} decks): ${c.core.map((x) => contextLine(x, false)).join('; ')}. `
      + `Flex (varies by build): ${c.flex.map((x) => contextLine(x, true)).join('; ')}. `
      + `Avg color curve: ${c.colorCurve.red}R/${c.colorCurve.yellow}Y/${c.colorCurve.blue}B.`,
    ...(viewCards.length
      ? { cards: viewCards, cardsSubtitle: `Every card across these ${c.deckCount} decks — ${c.core.length} core + ${c.flex.length} flex` }
      : {}),
    ...(tableSections.length ? { tableSections, tableNoteHeader: 'Decks' } : {}),
  };
}

/** One card lifted from any structured tool payload, ready to index by name. */
export interface HarvestedCard {
  name: string;
  pitch?: number;
  preview: CardPreview;
}

/**
 * Hover previews for INSTANT results: card names in AI replies hover-link only
 * if the session's card index knows them, and tool-free turns (deck context
 * rides the queue) never harvest anything — so data items' table rows feed the
 * same index. A CardRow already has the {name, pitch, preview} shape.
 */
export function harvestCardsFromDataItem(item: {
  tableRows?: CardRow[];
  tableSections?: Array<{ title: string; count: number; rows: CardRow[] }>;
}): HarvestedCard[] {
  const rows = [
    ...(item.tableSections ?? []).flatMap((s) => s.rows),
    ...(item.tableRows ?? []),
  ];
  return rows
    .filter((r) => !!r.preview?.imageUrl)
    .map((r) => ({ name: r.name, pitch: r.pitch, preview: r.preview }));
}

// Field extractors tolerant of every shape a card arrives in: get_deck flattens
// to top-level {printingId,name,pitch}; get_binder uses {printingId,name}; the
// wants route uses snake {printing_id, display_name}; search projects
// {printing_id, name, pitch}; the client-drill shape nests under printingDetails.
function harvestOne(raw: any, out: HarvestedCard[]): void {
  if (!raw || typeof raw !== 'object') return;
  const d = raw.printingDetails ?? {};
  const name = raw.name ?? raw.display_name ?? d.display_name ?? d.name;
  if (!name || typeof name !== 'string') return;
  const printingId = raw.printingId ?? raw.printing_id ?? d.printing_id ?? undefined;
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) || undefined : undefined);
  const rawPitch = raw.pitch ?? d.pitch;
  const pitch = typeof rawPitch === 'number' && rawPitch > 0 ? rawPitch : undefined;
  out.push({
    name,
    pitch,
    preview: {
      imageUrl: getCardImageUrl(raw.image_url || d.image_url ? raw : { printingId }),
      name,
      printingId,
      priceLow: num(raw.tcg_low ?? d.tcg_low ?? raw.price),
      priceMarket: num(raw.tcg_market ?? d.tcg_market),
      // Rail's "Available for purchase here" affiliate link — without this,
      // hovering a card named in an AI reply opened a buy-link-less rail.
      tcgplayerUrl: raw.tcgplayer_url ?? d.tcgplayer_url ?? undefined,
    },
  });
}

/**
 * Universal card harvester: pulls {name, pitch, printingId, preview} out of any
 * card-bearing tool payload (search_printings, get_deck, get_binder, get_wants)
 * so card names Volzar mentions in its answer can hover-preview in the rail —
 * not just the ones from a search. Unknown/cardless payloads yield [].
 */
export function harvestCardsFromStructured(structured: any): HarvestedCard[] {
  const out: HarvestedCard[] = [];
  if (!structured || typeof structured !== 'object') return out;

  // search_printings — harvest EVERY card group, not just results[0].
  if (Array.isArray(structured.results)) {
    for (const group of structured.results) {
      for (const p of group?.printings ?? []) harvestOne(p, out);
    }
  }
  // get_binder / get_wants — flat cards[].
  if (Array.isArray(structured.cards)) {
    for (const c of structured.cards) harvestOne(c, out);
  }
  // get_deck — hero, weapon, equipment slots, and deck categories.
  const deck = structured.deck;
  if (deck && typeof deck === 'object') {
    harvestOne(deck.heroCard, out);
    harvestOne(deck.weapon, out);
    for (const section of [deck.equipment, deck.categories]) {
      if (!section || typeof section !== 'object') continue;
      for (const slot of Object.values(section)) {
        if (Array.isArray(slot)) for (const c of slot) harvestOne(c, out);
      }
    }
  }
  return out;
}

/** Wraps queued quick-action context into the next user turn's content. */
export function buildMessageWithContext(pendingContext: string[], userText: string): string {
  if (pendingContext.length === 0) return userText;
  return [
    '[Context — data the user is currently looking at, from instant page actions:]',
    ...pendingContext,
    '',
    userText,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Workspace panel routing (chat = the log, workspace = the thing)
// ---------------------------------------------------------------------------

/**
 * Should this instant result take over the workspace panel? Yes for anything
 * the user reads or clicks through — card tables AND listings (drill lines:
 * binder/deck pickers). No for plain informational cards ("Added to binder…"),
 * which stay purely in the transcript.
 */
export function shouldOpenInWorkspace(result: {
  lines: CardLine[];
  tableRows?: unknown[];
  tableSections?: unknown[];
}): boolean {
  if ((result.tableRows?.length ?? 0) > 0 || (result.tableSections?.length ?? 0) > 0) return true;
  return result.lines.some((l) => typeof l !== 'string' && !!l.drill);
}

/**
 * Workspace navigation stack. Top-level quick actions (actionId without ':')
 * start fresh — there is nothing to go "back" to. Drills (binder:x, deck:y,
 * deck-compare:z) push, so Back returns to the list they came from.
 */
export function advanceWorkspace<T>(stack: T[], item: T, actionId: string): T[] {
  return actionId.includes(':') ? [...stack, item] : [item];
}

/** Write target for the row ± quantity buttons in card tables. */
export type RowMutation =
  | { kind: 'binder'; binderId: string }
  | { kind: 'wants' }
  | { kind: 'deck'; publicId: string };

/**
 * Pure optimistic update: returns a copy of a data item with one row's qty
 * adjusted (row removed at zero, section count kept in sync). Rows match by
 * itemId when both sides have one (binder conditions), else printingId;
 * `section` scopes deck updates (a printing can sit in Maindeck AND Inventory).
 */
export function adjustItemRowQty<T extends {
  tableRows?: CardRow[];
  tableSections?: Array<{ title: string; count: number; rows: CardRow[] }>;
}>(item: T, key: { printingId?: string; itemId?: string; section?: string }, delta: number): T {
  const matches = (r: CardRow) =>
    key.itemId && r.itemId ? r.itemId === key.itemId : r.preview.printingId === key.printingId;
  const adjustRows = (rows: CardRow[]) => rows
    .map((r) => (matches(r) ? { ...r, qty: Math.max(0, (r.qty ?? 1) + delta) } : r))
    .filter((r) => !(matches(r) && (r.qty ?? 1) <= 0));
  if (item.tableSections) {
    return {
      ...item,
      tableSections: item.tableSections.map((s) =>
        key.section && s.title !== key.section
          ? s
          : { ...s, rows: adjustRows(s.rows), count: Math.max(0, s.count + (s.rows.some(matches) ? delta : 0)) }),
    };
  }
  if (item.tableRows) return { ...item, tableRows: adjustRows(item.tableRows) };
  return item;
}

/**
 * Pure optimistic update: returns a copy of a data item with one row's
 * for-trade flag set (same row matching rules as adjustItemRowQty).
 */
export function setItemRowForTrade<T extends { tableRows?: CardRow[] }>(
  item: T,
  key: { printingId?: string; itemId?: string },
  forTrade: boolean,
): T {
  if (!item.tableRows) return item;
  const matches = (r: CardRow) =>
    key.itemId && r.itemId ? r.itemId === key.itemId : r.preview.printingId === key.printingId;
  return { ...item, tableRows: item.tableRows.map((r) => (matches(r) ? { ...r, forTrade } : r)) };
}

/** Persist a binder row's For Trade toggle (the binder-tile switch). */
export async function setRowForTrade(
  mutation: RowMutation,
  row: CardRow,
  forTrade: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (mutation.kind !== 'binder') return { ok: false, error: 'Only binder cards carry a for-trade flag.' };
  if (!row.itemId) return { ok: false, error: 'This row is missing its inventory id — reopen the binder.' };
  const result = await bindersClient.updateBinderCard(mutation.binderId, row.itemId, { forTrade });
  if (!result.success) return { ok: false, error: result.error };
  return { ok: true };
}

/** Delete a binder row outright (the binder-tile trash — all copies at once). */
export async function removeRowEntirely(
  mutation: RowMutation,
  row: CardRow,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (mutation.kind !== 'binder') return { ok: false, error: 'Only binder rows can be deleted this way.' };
  if (!row.itemId) return { ok: false, error: 'This row is missing its inventory id — reopen the binder.' };
  const result = await bindersClient.deleteBinderCard(mutation.binderId, row.itemId);
  if (!result.success) return { ok: false, error: result.error };
  return { ok: true };
}

/**
 * Persist a row's ± quantity change to its source (binder / wants / deck).
 * Returns the new quantity so the caller can reconcile the optimistic UI.
 */
export async function adjustRowQuantity(
  mutation: RowMutation,
  row: CardRow,
  delta: 1 | -1,
  sectionTitle?: string,
): Promise<{ ok: true; newQty: number } | { ok: false; error: string }> {
  const printingId = row.preview.printingId;
  const newQty = Math.max(0, (row.qty ?? 1) + delta);
  if (mutation.kind === 'binder') {
    if (!row.itemId) return { ok: false, error: 'This row is missing its inventory id — reopen the binder.' };
    const result = newQty === 0
      ? await bindersClient.deleteBinderCard(mutation.binderId, row.itemId)
      : await bindersClient.updateBinderCard(mutation.binderId, row.itemId, { quantity: newQty });
    if (!result.success) return { ok: false, error: result.error };
    return { ok: true, newQty };
  }
  if (!printingId) return { ok: false, error: 'This row is missing its printing id.' };
  if (mutation.kind === 'wants') {
    const result = delta > 0
      ? await wantsClient.addWantsItem(printingId, 1)
      : await wantsClient.removeWantsItem(printingId, false, 1);
    if (!result.success) return { ok: false, error: result.error };
    return { ok: true, newQty };
  }
  // deck — resolve the category from the section title (handles pitch-split
  // subsection titles and Bench → 'benched')
  const category = deckCategoryFromSection(sectionTitle);
  const result = delta > 0
    ? await decksClient.addPrintings(mutation.publicId, [{ printingId, quantity: 1, category }])
    : await decksClient.removePrinting(mutation.publicId, printingId, category, 1);
  if (!result.success) return { ok: false, error: result.error };
  return { ok: true, newQty };
}

/**
 * Undo a row removal (the − at quantity 1): re-add the removed printing to
 * its source with the original quantity — and priority (wants), for-trade
 * flag (binder), or section/category (deck). A binder re-add creates a fresh
 * inventory item with default condition; the original condition/notes are
 * not recoverable once deleted.
 */
export async function undoRowRemoval(
  mutation: RowMutation,
  row: CardRow,
  sectionTitle?: string,
): Promise<AddCardOutcome> {
  const printingId = row.preview.printingId;
  if (!printingId) return { ok: false, error: 'This row is missing its printing id.' };
  const qty = row.qty ?? 1;
  if (mutation.kind === 'binder') {
    const result = await bindersClient.addCardsToBinder(mutation.binderId, [
      { printingId, quantity: qty, forTrade: row.forTrade },
    ]);
    if (!result.success) return { ok: false, error: result.error };
    return { ok: true, name: row.name };
  }
  if (mutation.kind === 'wants') {
    const result = await wantsClient.addWantsItem(printingId, qty, (row.priority as any) ?? 'medium');
    if (!result.success) return { ok: false, error: result.error };
    return { ok: true, name: row.name };
  }
  const category = deckCategoryFromSection(sectionTitle);
  const result = await decksClient.addPrintings(mutation.publicId, [{ printingId, quantity: qty, category }]);
  if (!result.success) return { ok: false, error: result.error };
  return { ok: true, name: row.name };
}

/**
 * Rebuild a transcript/workspace data item from a fresh drill of its source
 * (after a dialog add wrote server-side, the open table must show it). The
 * identity fields (kind, uid) survive; every displayed field comes from the
 * fresh result — including `undefined`s, so stale tables can't linger.
 */
export function refreshDataItem<T extends { kind: string; uid?: string }>(
  item: T,
  fresh: QuickActionResult,
): T {
  return {
    ...item,
    title: fresh.title,
    lines: fresh.lines,
    cards: fresh.cards,
    cardsSubtitle: fresh.cardsSubtitle,
    tableRows: fresh.tableRows,
    tableSections: fresh.tableSections,
    tableNoteHeader: fresh.tableNoteHeader,
    copyHeader: fresh.copyHeader,
    deckStats: fresh.deckStats,
    compareDrill: fresh.compareDrill,
    deckPublicId: fresh.publicId,
    deckEditable: fresh.deckEditable,
    mutate: fresh.mutate,
    resultRows: fresh.resultRows,
    wantsAdd: fresh.wantsAdd,
    compareRefresh: fresh.compareRefresh,
  };
}

/** MCP tools that mutate a binder / wants list / deck — after one succeeds,
 *  every open table showing that data must refetch or the write looks lost. */
export const WRITE_TOOLS = new Set([
  'add_to_binder', 'remove_from_binder',
  'add_to_wants', 'remove_from_wants',
  'add_cards_to_deck', 'remove_cards_from_deck',
  'update_deck', 'create_deck',
]);

/** A refetch target for refreshItemsForTarget-style refreshes. */
export type RefreshTarget = { destination: 'binder' | 'wants' | 'deck'; binderId?: string; deckPublicId?: string };

/**
 * Distinct sources currently displayed as mutable tables. AI writes don't say
 * which binder/deck they touched in a machine-usable way, so after a write
 * tool succeeds we refresh everything on screen — deduped, this is 1-2 drills.
 */
export function collectMutationTargets(items: Array<{ kind?: string; mutate?: RowMutation }>): RefreshTarget[] {
  const seen = new Set<string>();
  const out: RefreshTarget[] = [];
  for (const item of items) {
    if (item.kind !== 'data' || !item.mutate) continue;
    const m = item.mutate;
    const target: RefreshTarget = m.kind === 'binder'
      ? { destination: 'binder', binderId: m.binderId }
      : m.kind === 'deck'
        ? { destination: 'deck', deckPublicId: m.publicId }
        : { destination: 'wants' };
    const key = `${target.destination}|${target.binderId ?? target.deckPublicId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(target);
  }
  return out;
}

/** The printing fields swapped onto a row (shape of printingToSwapOption). */
export interface RowSwapOption {
  printingId: string;
  collector?: string;
  foiling?: string;
  isExtendedArt?: boolean;
  priceLow?: number;
  priceMarket?: number;
  preview: CardPreview;
}

/**
 * Pure optimistic update for a printing swap: replaces the matched row's
 * printing-specific fields (qty + name stay). If a sibling row in the same
 * scope already holds the target printing, the two merge (qty sums) —
 * mirroring the binder swap endpoint's server-side merge.
 */
export function swapItemRowPrinting<T extends {
  tableRows?: CardRow[];
  tableSections?: Array<{ title: string; count: number; rows: CardRow[] }>;
}>(item: T, key: { printingId?: string; itemId?: string; section?: string }, swap: RowSwapOption): T {
  const matches = (r: CardRow) =>
    key.itemId && r.itemId ? r.itemId === key.itemId : r.preview.printingId === key.printingId;
  const swapRows = (rows: CardRow[]) => {
    const source = rows.find(matches);
    if (!source) return rows;
    const existing = rows.find((r) => !matches(r) && r.preview.printingId === swap.printingId);
    if (existing) {
      // Merge: server combined the quantities onto the target printing.
      return rows
        .filter((r) => !matches(r))
        .map((r) => (r === existing ? { ...r, qty: (r.qty ?? 1) + (source.qty ?? 1) } : r));
    }
    return rows.map((r) => (matches(r) ? {
      ...r,
      collector: swap.collector,
      foiling: swap.foiling,
      extendedArt: !!swap.isExtendedArt,
      price: swap.priceLow ?? swap.priceMarket,
      image: swap.preview.imageUrl,
      preview: swap.preview,
    } : r));
  };
  if (item.tableSections) {
    return {
      ...item,
      tableSections: item.tableSections.map((s) =>
        key.section && s.title !== key.section ? s : { ...s, rows: swapRows(s.rows) }),
    };
  }
  if (item.tableRows) return { ...item, tableRows: swapRows(item.tableRows) };
  return item;
}

/**
 * Persist a printing swap to its source. Wants has no swap endpoint — it is
 * add-then-remove (in that order: a mid-flight failure duplicates the want
 * instead of losing it). Binder uses the dedicated swap endpoint (server
 * merges duplicates); decks swap within the row's section/category.
 */
export async function swapRowPrinting(
  mutation: RowMutation,
  row: CardRow,
  newPrintingId: string,
  sectionTitle?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const oldPrintingId = row.preview.printingId;
  if (mutation.kind === 'binder') {
    if (!row.itemId) return { ok: false, error: 'This row is missing its inventory id — reopen the binder.' };
    const result = await bindersClient.swapBinderCardPrinting(mutation.binderId, row.itemId, newPrintingId);
    if (!result.success) return { ok: false, error: result.error };
    return { ok: true };
  }
  if (!oldPrintingId) return { ok: false, error: 'This row is missing its printing id.' };
  if (mutation.kind === 'wants') {
    const added = await wantsClient.addWantsItem(newPrintingId, row.qty ?? 1, (row.priority as any) ?? 'medium');
    if (!added.success) return { ok: false, error: added.error };
    const removed = await wantsClient.removeWantsItem(oldPrintingId, true);
    if (!removed.success) return { ok: false, error: `Added the new printing, but removing the old one failed: ${removed.error}` };
    return { ok: true };
  }
  const category = deckCategoryFromSection(sectionTitle);
  const result = await decksClient.swapPrinting(mutation.publicId, oldPrintingId, newPrintingId, category);
  if (!result.success) return { ok: false, error: result.error };
  return { ok: true };
}

/**
 * Create a binder from the tri-button dropdown and make it the add target.
 * The returned context line rides the pending-context queue so the NEXT chat
 * message teaches Volzar the binder exists — "put 3 Command and Conquer in
 * <name>" then resolves via the add_to_binder tool without any lookup.
 */
export async function createBinderTarget(name: string, existingSlugs: string[]): Promise<
  | { ok: true; binder: { _id: string; name: string }; context: string }
  | { ok: false; error: string }
> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'Binder name is required.' };
  // POST /api/binders requires name AND slug; derive it like the collection page.
  const slug = generateUniqueBinderSlug(trimmed, existingSlugs);
  const result = await bindersClient.createBinder({ name: trimmed, slug } as any);
  if (!result.success) return { ok: false, error: result.error };
  // Tolerate both wire shapes ({...binder} or {binder: {...}}) and id vs _id.
  const raw = result.data as any;
  const binder = raw?.binder ?? raw;
  const id = binder?._id ?? binder?.id;
  if (!id) return { ok: false, error: 'Binder created but no id returned — reload and try again.' };
  const binderName = binder?.name ?? trimmed;
  return {
    ok: true,
    binder: { _id: String(id), name: binderName },
    context: `The user just created a new EMPTY binder named "${binderName}". When they ask to add cards to it (by this name), use the add_to_binder tool targeting binder "${binderName}".`,
  };
}

/**
 * Tile-menu "Move to …": remove EVERY copy from the source category, then
 * re-add the row's quantity to the target — the same two-call sequence the
 * deck page's move buttons use. Caller re-drills the deck afterwards.
 */
export async function moveDeckRow(
  publicId: string,
  row: CardRow,
  fromSectionTitle: string | undefined,
  to: DeckSectionCategory,
): Promise<AddCardOutcome> {
  const printingId = row.preview.printingId;
  if (!printingId) return { ok: false, error: 'This row is missing its printing id.' };
  const removed = await decksClient.removePrinting(publicId, printingId, deckCategoryFromSection(fromSectionTitle), 999999);
  if (!removed.success) return { ok: false, error: removed.error };
  const added = await decksClient.addPrintings(publicId, [{ printingId, quantity: row.qty ?? 1, category: to }]);
  if (!added.success) return { ok: false, error: added.error };
  return { ok: true, name: row.name };
}

/** Tile-menu "Delete all copies" — the 999999 sentinel removes the row outright. */
export async function removeAllDeckCopies(
  publicId: string,
  row: CardRow,
  fromSectionTitle: string | undefined,
): Promise<AddCardOutcome> {
  const printingId = row.preview.printingId;
  if (!printingId) return { ok: false, error: 'This row is missing its printing id.' };
  const removed = await decksClient.removePrinting(publicId, printingId, deckCategoryFromSection(fromSectionTitle), 999999);
  if (!removed.success) return { ok: false, error: removed.error };
  return { ok: true, name: row.name };
}

export type DeckOwnership = Map<string, { owned: number; needed: number }>;

/**
 * Collection ownership per printing (the deck page's green/red tile dots) —
 * one instant inventory-comparison call. null on failure: dots are
 * best-effort and must never block the deck view.
 */
export async function fetchDeckOwnership(publicId: string): Promise<DeckOwnership | null> {
  try {
    const result = await decksClient.getInventoryComparison(publicId);
    if (!result.success) return null;
    const d = result.data as any;
    const map: DeckOwnership = new Map();
    for (const i of d.owned ?? []) map.set(i.printingId, { owned: i.owned, needed: i.needed });
    for (const i of d.partial ?? []) map.set(i.printingId, { owned: i.owned, needed: i.needed });
    for (const i of d.missing ?? []) map.set(i.printingId, { owned: 0, needed: i.needed });
    return map;
  } catch {
    return null;
  }
}

/** One row of GET /api/results/performance — the deck dashboard's fuel. */
export interface DeckPerfRow {
  deckPublicId?: string;
  games?: number;
  wins?: number;
  losses?: number;
  winRatePct?: number;
  lastPlayedAt?: string;
  bestMatchup?: { opponentHero: string; games: number; wins: number } | null;
  worstMatchup?: { opponentHero: string; games: number; wins: number } | null;
}

/** Collapse a DeckOwnership map to coverage totals (extra copies don't count). */
export function ownershipSummary(map: DeckOwnership): { owned: number; needed: number } {
  let owned = 0, needed = 0;
  for (const v of map.values()) {
    needed += v.needed;
    owned += Math.min(v.owned, v.needed);
  }
  return { owned, needed };
}

const titleCaseHero = (name: string) =>
  name.split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

/**
 * The deck dashboard's 💡 Insights bullets — instant, no AI, built only from
 * data already fetched (ownership comparison + the performance endpoint).
 * Returns [] when there's nothing worth saying; the section hides itself.
 */
export function deckInsightLines(input: {
  ownership?: { owned: number; needed: number } | null;
  perf?: DeckPerfRow | null;
}): string[] {
  const out: string[] = [];
  const o = input.ownership;
  if (o && o.needed > 0) {
    const missing = Math.max(0, o.needed - o.owned);
    out.push(missing === 0
      ? `You own all ${o.needed} cards in this deck`
      : `You own ${o.owned} of ${o.needed} cards — ${missing} missing`);
  }
  const p = input.perf;
  if (p && (p.games ?? 0) > 0) {
    out.push(`Talishar record ${p.wins ?? 0}–${p.losses ?? 0}${
      typeof p.winRatePct === 'number' ? ` (${p.winRatePct}% win rate)` : ''}`);
    if (p.bestMatchup && p.bestMatchup.games > 0) {
      out.push(`Strong vs ${titleCaseHero(p.bestMatchup.opponentHero)} (${p.bestMatchup.wins}–${p.bestMatchup.games - p.bestMatchup.wins})`);
    }
    if (p.worstMatchup && p.worstMatchup.games > 0) {
      out.push(`Weak into ${titleCaseHero(p.worstMatchup.opponentHero)} (${p.worstMatchup.wins}–${p.worstMatchup.games - p.worstMatchup.wins})`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Add-card runners (CardSearchDialog → binder / wants)
// ---------------------------------------------------------------------------

/** First argument of CardSearchDialog's onSelectCard. */
export interface CardSearchSelection {
  card?: { name?: string; types?: string[] };
  printing?: { printing_id?: string; unique_id?: string; display_name?: string; types?: string[] };
  quantity?: number;
  forTrade?: boolean;
}

export type AddCardOutcome = { ok: true; name: string } | { ok: false; error: string };

function selectionPrinting(selection: CardSearchSelection): { printingId?: string; name: string; quantity: number } {
  const printingId = selection.printing?.printing_id || selection.printing?.unique_id;
  return {
    printingId,
    name: selection.printing?.display_name || selection.card?.name || 'card',
    quantity: selection.quantity ?? 1,
  };
}

export async function addSearchSelectionToBinder(
  binderId: string,
  selection: CardSearchSelection,
): Promise<AddCardOutcome> {
  const { printingId, name, quantity } = selectionPrinting(selection);
  if (!printingId) return { ok: false, error: 'No printing selected.' };
  const result = await bindersClient.addCardsToBinder(binderId, [
    // forTrade passes through verbatim: BinderService-style `?? true` here
    // would silently flip the dialog's "available for trade" toggle when off.
    { printingId, quantity, forTrade: selection.forTrade },
  ]);
  if (!result.success) return { ok: false, error: result.error };
  return { ok: true, name };
}

export async function addSearchSelectionToWants(
  selection: CardSearchSelection,
): Promise<AddCardOutcome> {
  const { printingId, name, quantity } = selectionPrinting(selection);
  if (!printingId) return { ok: false, error: 'No printing selected.' };
  const result = await wantsClient.addWantsItem(printingId, quantity);
  if (!result.success) return { ok: false, error: result.error };
  return { ok: true, name };
}

export async function addSearchSelectionToDeck(
  deckPublicId: string,
  selection: CardSearchSelection,
): Promise<AddCardOutcome> {
  const { printingId, name, quantity } = selectionPrinting(selection);
  if (!printingId) return { ok: false, error: 'No printing selected.' };
  // Same category rule as the deck editor's search (inferCategory in
  // MobileCardSearch): hero → hero, equipment/weapon → equipment, else maindeck.
  const types = (selection.card?.types ?? selection.printing?.types ?? []).map((t) => t.toLowerCase());
  const category = types.includes('hero') ? 'hero'
    : types.includes('equipment') || types.includes('weapon') ? 'equipment'
    : 'maindeck';
  const result = await decksClient.addPrintings(deckPublicId, [{ printingId, quantity, category }]);
  if (!result.success) return { ok: false, error: result.error };
  return { ok: true, name };
}

// ---------------------------------------------------------------------------
// Action runners (thin client-service wiring; parse legacy wire shapes)
// ---------------------------------------------------------------------------

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'binders',
    label: 'My binders',
    run: async () => {
      const result = await bindersClient.getUserBinders();
      if (!result.success) throw new Error(result.error);
      const binders = (result.data as any)?.binders ?? [];
      return summarizeBinders(binders);
    },
  },
  {
    id: 'wants',
    label: 'My wants',
    run: async () => {
      const result = await wantsClient.getUserWants();
      if (!result.success) throw new Error(result.error);
      // Legacy wire shape: { success, wantsList: { cards: [...] } }
      const cards = (result.data as any)?.wantsList?.cards ?? (result.data as any)?.items ?? [];
      return summarizeWantsCards(cards);
    },
  },
  {
    id: 'decks',
    label: 'My decks',
    run: async () => {
      // NOT getUserDecksBasic — it fetches /api/decks/basic, which 404s
      // (dead endpoint). GET /api/decks returns { success, decks } (legacy
      // shape, no `data` key — same handleResponse passthrough as wants).
      // Request ALL decks: summarizeDecks partitions out featured/system decks
      // client-side, so any server-side page cap would fill with a curator's
      // reference decks and silently hide personal ones (same bug as the
      // /decks page, fixed in 1fccbc6).
      const result = await decksClient.getUserDecks(undefined, { limit: 100000 });
      if (!result.success) throw new Error(result.error);
      const decks = (result.data as any)?.decks ?? [];
      return summarizeDecks(decks);
    },
  },
  {
    id: 'results',
    label: 'Game results',
    run: async () => {
      // Cross-deck, owner-scoped recent games (newest first). allowOAuth route.
      const response = await fetch('/api/results/recent?limit=50', { credentials: 'include' });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Could not load game results');
      return summarizeGameResults(data.data ?? []);
    },
  },
];

/** Drill-down: contents of one binder (from a click on the binders card). */
export async function runBinderDrill(binderId: string, binderName: string): Promise<QuickActionResult> {
  const result = await bindersClient.getBinderCards(binderId, {}, { limit: 100 });
  if (!result.success) throw new Error(result.error);
  // Legacy wire shape: { success, cards, pagination } (no `data` key)
  const raw = result.data as any;
  const cards = raw?.cards ?? [];
  const totalQuantity = raw?.pagination?.totalQuantity;
  return summarizeBinderCards(binderName, cards, totalQuantity, binderId);
}

/** Drill-down: full deck contents (from a click on the decks card). */
export async function runDeckDrill(publicId: string): Promise<QuickActionResult> {
  const result = await decksClient.getDeck(publicId);
  if (!result.success) throw new Error(result.error);
  return summarizeDeckContents({ ...(result.data as any), publicId });
}

export function summarizeComparison(
  deckName: string,
  comparison: {
    owned?: Array<{ printingId: string; cardName: string; needed: number; owned: number; pitch?: number }>;
    partial?: Array<{ printingId: string; cardName: string; needed: number; owned: number; pitch?: number; tcgLow?: number; tcgMarket?: number; tcgplayerUrl?: string }>;
    missing?: Array<{ printingId: string; cardName: string; needed: number; tcgMarket?: number; pitch?: number; tcgLow?: number; tcgplayerUrl?: string }>;
  },
): QuickActionResult {
  const owned = comparison.owned ?? [];
  const partial = comparison.partial ?? [];
  const missing = comparison.missing ?? [];
  const missingCost = missing.reduce((sum, m) => sum + ((m.tcgLow ?? m.tcgMarket) ?? 0) * m.needed, 0);

  const lines: CardLine[] = [];
  if (missing.length > 0) {
    lines.push(`— Missing (${missing.length} cards${missingCost > 0 ? ` · ~$${missingCost.toFixed(2)}` : ''}) —`);
    lines.push(...missing.map((m) => ({
      text: `${m.needed}× ${m.cardName}${m.tcgLow ?? m.tcgMarket ? ` · $${(m.tcgLow ?? m.tcgMarket)!.toFixed(2)}` : ''}`,
      pitch: m.pitch,
      preview: {
        imageUrl: getCardImageUrl({ printingId: m.printingId }),
        name: m.cardName,
        printingId: m.printingId,
        priceLow: m.tcgLow,
        priceMarket: m.tcgMarket,
        tcgplayerUrl: m.tcgplayerUrl,
      },
    })));
  }
  if (partial.length > 0) {
    lines.push(`— Partial (${partial.length}) —`);
    lines.push(...partial.map((p) => ({
      text: `${p.cardName} — own ${p.owned}/${p.needed}`,
      pitch: p.pitch,
      preview: {
        imageUrl: getCardImageUrl({ printingId: p.printingId }),
        name: p.cardName,
        printingId: p.printingId,
        priceLow: p.tcgLow,
        priceMarket: p.tcgMarket,
        tcgplayerUrl: p.tcgplayerUrl,
      },
    })));
  }

  // Section-grouped card-table rows — the same striped table the decklist
  // renders, with owned/needed riding the tail "Owned" column.
  const toCompareRow = (c: { printingId: string; cardName: string; needed: number; pitch?: number; tcgLow?: number; tcgMarket?: number; tcgplayerUrl?: string }, ownedCount: number): CardRow => ({
    qty: c.needed,
    name: c.cardName,
    pitch: typeof c.pitch === 'number' && c.pitch > 0 ? c.pitch : undefined,
    image: getCardImageUrl({ printingId: c.printingId }),
    price: c.tcgLow ?? c.tcgMarket,
    note: `${ownedCount}/${c.needed}`,
    // shortage = copies still unrecorded — powers the per-row quick-add
    // (heart → wants, folder → binder) so "I actually own this" is one click.
    addQty: c.needed - ownedCount,
    preview: {
      imageUrl: getCardImageUrl({ printingId: c.printingId }),
      name: c.cardName,
      printingId: c.printingId,
      priceLow: c.tcgLow,
      priceMarket: c.tcgMarket,
      tcgplayerUrl: c.tcgplayerUrl,
    },
  });
  const tableSections: Array<{ title: string; count: number; rows: CardRow[] }> = [];
  if (missing.length > 0) {
    tableSections.push({
      title: `Missing${missingCost > 0 ? ` — ~$${missingCost.toFixed(2)}` : ''}`,
      count: missing.length,
      rows: missing.map((m) => toCompareRow(m, 0)),
    });
  }
  if (partial.length > 0) {
    tableSections.push({
      title: 'Partial',
      count: partial.length,
      rows: partial.map((p) => toCompareRow(p, p.owned)),
    });
  }

  // "View as cards" overlay = the cards you still need (missing in full +
  // the shortage of partial), so you can eyeball what's left to acquire.
  const viewCards: DeckViewCard[] = [
    ...missing.map((m) => ({ printingId: m.printingId, name: m.cardName, quantity: m.needed, pitch: m.pitch, imageUrl: getCardImageUrl({ printingId: m.printingId }) })),
    ...partial.map((p) => ({ printingId: p.printingId, name: p.cardName, quantity: Math.max(1, p.needed - p.owned), pitch: p.pitch, imageUrl: getCardImageUrl({ printingId: p.printingId }) })),
  ];

  // One-click wants payload: the same cards the overlay shows you still need,
  // using each deck's CURATED printing (the printing can be swapped later). All
  // medium priority. Empty → no button rendered.
  const wantsAdd: NonNullable<QuickActionResult['wantsAdd']> = [
    ...missing.map((m) => ({ printingId: m.printingId, quantity: m.needed, priority: 'medium' as const })),
    ...partial.map((p) => ({ printingId: p.printingId, quantity: Math.max(1, p.needed - p.owned), priority: 'medium' as const })),
  ];
  lines.push(missing.length === 0 && partial.length === 0
    ? `✓ You own everything in this deck (${owned.length} cards)`
    : `✓ Fully owned: ${owned.length} cards`);

  return {
    title: `You vs. ${deckName}`,
    lines,
    context: `Collection comparison for deck "${deckName}": fully owned ${owned.length}; partial ${
      partial.map((p) => `${p.cardName} (${p.owned}/${p.needed})`).join(', ') || 'none'
    }; missing ${missing.map((m) => `${m.needed}x ${m.cardName}`).join(', ') || 'none'}${
      missingCost > 0 ? `; missing cards cost ~$${missingCost.toFixed(2)} total` : ''
    }`,
    ...(viewCards.length
      ? { cards: viewCards, cardsSubtitle: `Cards you're missing — not yet in your collection (${viewCards.length})` }
      : {}),
    ...(wantsAdd.length ? { wantsAdd } : {}),
    ...(tableSections.length ? { tableSections, tableNoteHeader: 'Owned' } : {}),
  };
}

/** Drill-down: what the user owns vs a deck (instant, via inventory comparison). */
export async function runDeckCompareDrill(publicId: string, deckName: string): Promise<QuickActionResult> {
  // matchBy 'card': any printing of a card you own counts — the deckbuilding
  // question is "do I have the cards", not "the exact printing the deck lists".
  const result = await decksClient.getInventoryComparison(publicId, { binderMode: 'all', matchBy: 'card' });
  if (!result.success) throw new Error(result.error);
  const raw = result.data as any;
  return {
    ...summarizeComparison(deckName, raw?.comparison ?? raw ?? {}),
    compareRefresh: { publicId, deckName },
  };
}

/**
 * Row quick-add: record the shortage of a comparison row on the wants list —
 * "I still need these" without leaving the row.
 */
export async function addCompareRowToWants(row: CardRow): Promise<AddCardOutcome> {
  const printingId = row.preview.printingId;
  const qty = row.addQty ?? 0;
  if (!printingId || qty < 1) return { ok: false, error: 'Nothing to add.' };
  const result = await wantsClient.addWantsItem(printingId, qty);
  if (!result.success) return { ok: false, error: result.error };
  return { ok: true, name: row.name };
}

/**
 * Row quick-add: record the shortage of a comparison row in a binder — the
 * "I actually own these, my collection just doesn't know it" correction.
 * forTrade false: these are cards the user owns and intends to PLAY in this
 * deck — advertising them for trade must be an explicit act on the binder.
 */
export async function addCompareRowToBinder(binderId: string, row: CardRow): Promise<AddCardOutcome> {
  const printingId = row.preview.printingId;
  const qty = row.addQty ?? 0;
  if (!printingId || qty < 1) return { ok: false, error: 'Nothing to add.' };
  const result = await bindersClient.addCardsToBinder(binderId, [
    { printingId, quantity: qty, forTrade: false },
  ]);
  if (!result.success) return { ok: false, error: result.error };
  return { ok: true, name: row.name };
}

/**
 * Lines for the compare_collection_to_decks_to_beat tool's structured payload
 * (structuredContent.coverageDecks). Each deck renders as a clickable line
 * that drills into the existing You-vs-deck comparison — the missing-cards
 * delta — with zero AI tokens.
 */
export function parseCoverageLines(structured: unknown): CardLine[] | undefined {
  if (!structured || typeof structured !== 'object') return undefined;
  const rows = (structured as { coverageDecks?: unknown }).coverageDecks;
  if (!Array.isArray(rows) || rows.length === 0) return undefined;
  const lines: CardLine[] = [];
  for (const raw of rows) {
    const r = raw as Record<string, unknown>;
    if (typeof r.publicId !== 'string' || typeof r.deckName !== 'string') continue;
    const pct = Number(r.coveragePct);
    const owned = Number(r.totalOwned);
    const needed = Number(r.totalNeeded);
    const missing = Number(r.missingCards);
    const cost = Number(r.missingCost);
    const tail = missing > 0
      ? `${missing} missing${cost > 0 ? ` · $${cost.toFixed(2)} to finish` : ''}`
      : 'complete ✓';
    lines.push({
      text: `${pct}% (${owned}/${needed}) — ${r.deckName} · ${tail}`,
      drill: { kind: 'deck-compare', id: r.publicId, name: r.deckName },
    });
  }
  return lines.length > 0 ? lines : undefined;
}

/** Dispatch a drill target from a clicked line. */
export function runDrill(drill: DrillTarget): Promise<QuickActionResult> {
  if (drill.kind === 'binder') return runBinderDrill(drill.id, drill.name);
  if (drill.kind === 'deck-compare') return runDeckCompareDrill(drill.id, drill.name);
  return runDeckDrill(drill.id);
}

// ---------------------------------------------------------------------------
// Decks to beat picker — scoped by hero (rolling window) or by event, because
// the unscoped featured list is too long to be useful as one card.
// ---------------------------------------------------------------------------

/** Rolling window for the by-hero scope (and the event picker's reach). */
export const TO_BEAT_MONTHS = 3;

export interface ToBeatDeckLite {
  publicId: string;
  name: string;
  placing?: number | null;
  eventName?: string | null;
  heroName?: string | null;
}

/** Format a scoped decks-to-beat list (by hero or by event) as a data card. */
export function summarizeToBeatDecks(scope: string, decks: ToBeatDeckLite[]): QuickActionResult {
  const medal = (placing?: number | null) => (placing === 1 ? '🥇 ' : placing === 2 ? '🥈 ' : placing === 3 ? '🥉 ' : '');
  const lines: CardLine[] = decks.length === 0
    ? [`No decks to beat found for ${scope}.`]
    : decks.map((d) => ({
        text: `${medal(d.placing)}${d.name}${d.eventName ? ` — ${d.eventName}` : ''}`,
        drill: { kind: 'deck' as const, id: d.publicId, name: d.name },
      }));
  return {
    title: `Decks to beat — ${scope} (${decks.length})`,
    lines,
    context: `Featured tournament decks ("decks to beat"), ${scope}: ${
      decks.map((d) => `${d.name}${d.heroName ? ` [${d.heroName}]` : ''}${d.placing ? ` (#${d.placing})` : ''}`).join('; ') || 'none'
    }`,
  };
}

/** One row of GET /api/decks/events (distinct featured events in a month). */
export interface EventSummary {
  eventName: string;
  eventDate: string;   // ISO YYYY-MM-DD
  format: string;
  count: number;
}

export interface ToBeatEvent {
  eventName: string;
  eventDate: string;
  formats: string[];
  count: number;
}

/**
 * Merge per-month event summary batches into picker options: dedupe by
 * event+date (the API returns one row per format), collect formats, sum
 * deck counts, newest event first.
 */
export function mergeEventSummaries(batches: EventSummary[][]): ToBeatEvent[] {
  const map = new Map<string, ToBeatEvent>();
  for (const batch of batches) {
    for (const e of batch) {
      const key = `${e.eventName}|${e.eventDate}`;
      const existing = map.get(key);
      if (existing) {
        if (!existing.formats.includes(e.format)) existing.formats.push(e.format);
        existing.count += e.count;
      } else {
        map.set(key, { eventName: e.eventName, eventDate: e.eventDate, formats: [e.format], count: e.count });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.eventDate.localeCompare(a.eventDate));
}

/** Current month first, walking backwards (for the per-month events API). */
export function recentYearMonths(count: number, now = new Date()): Array<{ year: number; month: number }> {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
}

/** ISO YYYY-MM-DD exactly n months back — the dateFrom of a rolling window. */
export function isoDateMonthsAgo(months: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Distinct featured events over the last TO_BEAT_MONTHS — populates the event picker. */
export async function fetchToBeatEvents(): Promise<ToBeatEvent[]> {
  const batches = await Promise.all(
    recentYearMonths(TO_BEAT_MONTHS).map(async ({ year, month }) => {
      const response = await fetch(`/api/decks/events?year=${year}&month=${month}`, { credentials: 'include' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.success) throw new Error(body?.error || 'Failed to load events');
      return (body.data ?? []) as EventSummary[];
    }),
  );
  return mergeEventSummaries(batches);
}

async function fetchFeaturedDecks(params: Record<string, string>): Promise<ToBeatDeckLite[]> {
  const qs = new URLSearchParams({ featured: 'true', limit: '50', ...params });
  const response = await fetch(`/api/decks/community?${qs}`, { credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.success) throw new Error(body?.error || 'Failed to load decks to beat');
  return body?.data?.decks ?? [];
}

/** Decks to beat for one hero over the rolling window. */
export async function runToBeatByHero(heroName: string, displayName: string): Promise<QuickActionResult> {
  const decks = await fetchFeaturedDecks({ heroName, dateFrom: isoDateMonthsAgo(TO_BEAT_MONTHS) });
  return summarizeToBeatDecks(`${displayName} · last ${TO_BEAT_MONTHS} mo`, decks);
}

/** Decks to beat from one event. */
export async function runToBeatByEvent(eventName: string): Promise<QuickActionResult> {
  const decks = await fetchFeaturedDecks({ eventName });
  return summarizeToBeatDecks(eventName, decks);
}

export interface ToBeatHero {
  heroName: string;      // exact stored value — matches the archetype query
  displayName: string;   // friendly label for the dropdown
  formats: string[];
}

/**
 * Distinct heroes among current featured "Decks to Beat" — populates the
 * archetype + decks-to-beat pickers. The community route clamps limit to
 * 50/page while the featured pool is 100+ decks, so PAGINATE until the
 * reported total is covered — a single page silently drops the heroes whose
 * decks sort later (they exist on the site but never reach the dropdown).
 */
export async function fetchToBeatHeroes(): Promise<ToBeatHero[]> {
  const PAGE_LIMIT = 50;
  const MAX_PAGES = 10; // safety backstop (500 featured decks)
  const map = new Map<string, { heroName: string; formats: Set<string> }>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await fetch(`/api/decks/community?featured=true&limit=${PAGE_LIMIT}&page=${page}`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.success) throw new Error(body?.error || 'Failed to load decks to beat');
    const decks: any[] = body?.data?.decks ?? [];
    for (const d of decks) {
      const heroName = d.heroName;
      if (!heroName) continue;
      const key = heroName.toLowerCase();
      const e = map.get(key) ?? { heroName, formats: new Set<string>() };
      if (d.format) e.formats.add(d.format);
      map.set(key, e);
    }
    const total = Number(body?.data?.total ?? decks.length);
    if (decks.length === 0 || page * PAGE_LIMIT >= total) break;
  }
  // Decks store hero_name in card-name (lowercase) form and the API's
  // heroDisplayName is just as unreliable — resolve through the hero
  // constants (nickname map first) like fetchKitHeroes does, so the picker
  // never mixes "arakni, huntsman" with "Dash I/O".
  const { toHeroDisplayName, getHeroInfo } = await import('@/lib/fab-constants/heroes');
  return [...map.values()]
    .map((e) => ({ heroName: e.heroName, displayName: toHeroDisplayName(e.heroName, getHeroInfo(e.heroName)?.shortName), formats: [...e.formats] }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export interface KitHero {
  heroName: string;      // stored value, e.g. "pleiades, superstar"
  displayName: string;   // friendly label for the dropdown
  kitCount: number;
}

/** Heroes with published kits in a format — populates the Hero-kit picker. */
export async function fetchKitHeroes(format: string): Promise<KitHero[]> {
  const response = await fetch(`/api/curated-lists/heroes?format=${encodeURIComponent(format)}`, { credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.success) throw new Error(body?.error || 'Failed to load kit heroes');
  const { toHeroDisplayName, getHeroInfo } = await import('@/lib/fab-constants/heroes');
  return (body.data ?? [])
    .filter((h: any) => h.heroName)
    .map((h: any) => ({
      heroName: h.heroName,
      displayName: toHeroDisplayName(h.heroName, getHeroInfo(h.heroName)?.shortName),
      kitCount: h.kitCount ?? 0,
    }))
    .sort((a: KitHero, b: KitHero) => a.displayName.localeCompare(b.displayName));
}

/** Fetch + format one hero's curated kit pool (deterministic, no AI). */
export async function runHeroKit(heroName: string, displayName: string, format: string): Promise<QuickActionResult> {
  // view=public: the authenticated GET routes superadmins → getAllLists() and
  // curators → getListsForCurator(), both card-LESS admin listings — the kit
  // rendered empty for exactly those roles. Public view = published lists WITH
  // cards, for every caller.
  const response = await fetch(`/api/curated-lists?heroName=${encodeURIComponent(heroName)}&view=public`, { credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.success) throw new Error(body?.error || 'Failed to load the hero kit');
  return summarizeHeroKit(displayName, format, body.data ?? []);
}

/** Fetch + format the deterministic archetype consensus for the picker. */
export async function runArchetypeConsensus(heroName: string, months: number, format?: string): Promise<QuickActionResult> {
  const params = new URLSearchParams({ heroName, months: String(months) });
  if (format) params.set('format', format);
  const response = await fetch(`/api/decks/archetype?${params}`, { credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.success) throw new Error(body?.error || 'Failed to compute consensus');
  return summarizeArchetypeConsensus(body.data);
}
