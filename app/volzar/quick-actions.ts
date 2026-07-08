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
import { getCardImageUrl } from '@/lib/utils';
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
  extendedArt?: boolean;
  marvel?: boolean;   // rarity 'v'
  forTrade?: boolean;
  priority?: string;
  /** Free-text tail-column note (e.g. archetype adoption "9/10 decks"). */
  note?: string;
  /** Grouped search: how many printings this representative row stands in for. */
  printingCount?: number;
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

/** Build a CardRow from a wants/binder card payload (tolerant of flat + nested shapes). */
function toCardRow(c: any): CardRow {
  const d = c.printingDetails ?? {};
  const name = c.display_name || d.display_name || c.name || 'Unknown card';
  const rawPrice = d.tcg_low ?? d.tcg_market ?? c.tcg_low ?? c.tcg_market ?? c.value;
  const price = typeof rawPrice === 'number' ? rawPrice : typeof rawPrice === 'string' ? parseFloat(rawPrice) || undefined : undefined;
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
    extendedArt: !!(c.is_extended_art ?? d.is_extended_art),
    marvel: (c.rarity ?? d.rarity) === 'v',
    forTrade: c.forTrade ?? undefined,
    priority: c.priority ?? undefined,
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
  /** Public id of the deck this card represents — enables the deterministic
   *  "Add to my decks" button (a session-auth copy, no AI). Deck drills only. */
  publicId?: string;
  /** Cross-deck game results → a table (Game results action). */
  resultRows?: GameResultRow[];
  /** Curated deck printings the user still needs (missing + partial shortfall),
   *  ready for a one-click, no-AI `wantsClient.bulkAddWants`. Comparison card only. */
  wantsAdd?: Array<{ printingId: string; quantity: number; priority: 'high' | 'medium' | 'low' }>;
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
    ...(cards.length ? { tableRows: cards.map(toCardRow), copyHeader: 'Wants:' } : {}),
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

export function summarizeDeckContents(deck: {
  publicId?: string;
  name: string;
  format?: string;
  heroName?: string;
  hero?: DeckCard[];
  equipment?: DeckCard[];
  maindeck?: DeckCard[];
  inventory?: DeckCard[];
}): QuickActionResult {
  const label = (c: DeckCard) => c.printingDetails?.display_name || c.printingDetails?.name || 'Unknown card';
  const cardLine = (c: DeckCard): CardLine => ({
    text: `${c.quantity ?? 1}× ${label(c)}`,
    pitch: c.printingDetails?.pitch,
    preview: toCardPreview(c, label(c)),
  });
  const contextLine = (c: DeckCard) =>
    `${c.quantity ?? 1}x ${label(c)}${c.printingDetails?.pitch ? ` (p${c.printingDetails.pitch})` : ''}`;

  const sections: Array<[string, DeckCard[]]> = [
    ['Hero', deck.hero ?? []],
    ['Equipment', deck.equipment ?? []],
    ['Maindeck', deck.maindeck ?? []],
    // Sideboard cards — matchup side-ins come from here, so the decklist table
    // (and the swap-row thumbnail lookup built from it) must include them.
    ['Inventory', deck.inventory ?? []],
  ];

  const lines: CardLine[] = [];
  const contextParts: string[] = [];
  for (const [sectionName, cards] of sections) {
    if (cards.length === 0) continue;
    const total = cards.reduce((sum, c) => sum + (c.quantity ?? 1), 0);
    lines.push(`— ${sectionName} (${total}) —`);
    lines.push(...cards.map(cardLine));
    contextParts.push(`${sectionName}: ${cards.map(contextLine).join(', ')}`);
  }
  // Instant, no-AI color breakdown of the maindeck — answers "how many blue
  // cards" the moment you open a deck, computed from pitch (not the LLM).
  let colorSummary = '';
  const colors = deckColorBreakdown(deck.maindeck ?? []);
  if (colors.red + colors.yellow + colors.blue > 0) {
    colorSummary = `🎨 Maindeck colors: ${colors.red} red · ${colors.yellow} yellow · ${colors.blue} blue`;
  }

  if (lines.length === 0) lines.push('This deck is empty.');
  else {
    if (deck.publicId) {
      lines.unshift({
        text: '✓ Check what I own vs. this deck',
        drill: { kind: 'deck-compare', id: deck.publicId, name: deck.name },
      });
    }
    if (colorSummary) lines.unshift(colorSummary);
  }

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
    context: `The user's deck "${deck.name}"${deck.heroName ? `, hero ${deck.heroName}` : ''}${deck.format ? `, format ${deck.format}` : ''}. ${colorSummary ? `Maindeck colors: ${colors.red} red / ${colors.yellow} yellow / ${colors.blue} blue. ` : ''}${contextParts.join('. ') || 'Empty deck.'}`,
    ...(viewCards.length ? { cards: viewCards, cardsSubtitle: 'Full decklist' } : {}),
    ...(tableSections.length ? { tableSections } : {}),
    ...(deck.publicId ? { publicId: deck.publicId } : {}),
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
  const dateLabel = (d?: string | Date | null) =>
    d ? String(typeof d === 'string' ? d : d.toISOString()).slice(0, 10) : '';
  const rows: GameResultRow[] = results.map((r) => ({
    deckName: r.deckName ?? 'Unknown deck',
    deckPublicId: r.deckPublicId,
    resultId: r.id,
    playerHero: heroLabel(r.playerHero),
    opponentHero: heroLabel(r.opponentHero),
    result: r.result === 'win' ? 'win' : 'loss',
    date: dateLabel(r.playedAt),
    ...(r.format ? { format: r.format } : {}),
  }));

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
      },
    };
  });

  return { tableRows, total: first.total ?? first.printings.length, shown: tableRows.length };
}

/** Shape returned by GET /api/decks/archetype (deterministic, no AI). */
export interface ArchetypeConsensusData {
  heroName: string;
  format?: string | null;
  months: number;
  consensus: {
    deckCount: number;
    core: Array<{ name: string; pitch?: number; decks: number; typicalQty: number; printingId?: string }>;
    flex: Array<{ name: string; pitch?: number; decks: number; typicalQty: number; printingId?: string }>;
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

  const cardLine = (card: { name: string; pitch?: number; decks: number; typicalQty: number; printingId?: string }, showRatio: boolean): CardLine => ({
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
  const toRow = (card: { name: string; pitch?: number; decks: number; typicalQty: number; printingId?: string }, note?: string): CardRow => ({
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

  const flexSummary = c.flex.slice(0, 8).map((f) => `${f.name} ${f.decks}/${c.deckCount}`).join(', ');
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
      + `Core (all decks): ${c.core.map((x) => `${x.typicalQty}× ${x.name}`).join(', ')}. `
      + `Flex (varies): ${flexSummary}. `
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
  return summarizeBinderCards(binderName, cards, totalQuantity);
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
  };
}

/** Drill-down: what the user owns vs a deck (instant, via inventory comparison). */
export async function runDeckCompareDrill(publicId: string, deckName: string): Promise<QuickActionResult> {
  // matchBy 'card': any printing of a card you own counts — the deckbuilding
  // question is "do I have the cards", not "the exact printing the deck lists".
  const result = await decksClient.getInventoryComparison(publicId, { binderMode: 'all', matchBy: 'card' });
  if (!result.success) throw new Error(result.error);
  const raw = result.data as any;
  return summarizeComparison(deckName, raw?.comparison ?? raw ?? {});
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

/** Distinct heroes among current featured "Decks to Beat" — populates the archetype picker. */
export async function fetchToBeatHeroes(): Promise<ToBeatHero[]> {
  const response = await fetch('/api/decks/community?featured=true&limit=50', { credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.success) throw new Error(body?.error || 'Failed to load decks to beat');
  const decks: any[] = body?.data?.decks ?? [];
  const map = new Map<string, { heroName: string; displayName: string; formats: Set<string> }>();
  for (const d of decks) {
    const heroName = d.heroName;
    if (!heroName) continue;
    const key = heroName.toLowerCase();
    const e = map.get(key) ?? { heroName, displayName: d.heroDisplayName || heroName, formats: new Set<string>() };
    if (d.format) e.formats.add(d.format);
    map.set(key, e);
  }
  return [...map.values()]
    .map((e) => ({ heroName: e.heroName, displayName: e.displayName, formats: [...e.formats] }))
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
