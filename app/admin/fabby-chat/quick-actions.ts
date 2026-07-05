// Quick actions for the Fabby chat: deterministic reads that need zero AI
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

export interface QuickActionResult {
  title: string;
  lines: CardLine[];
  /** Compact representation queued as context for the next AI turn. */
  context: string;
  /** Cards for the "View as cards" grid overlay (deck drills + consensus). */
  cards?: DeckViewCard[];
  /** Overlay subtitle clarifying what the card grid represents (e.g. "missing"). */
  cardsSubtitle?: string;
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
  cards: Array<{ display_name?: string; name?: string; quantity?: number; priority?: string; foiling?: string; pitch?: number; collector_number?: string; value?: string | number; printingDetails?: { display_name?: string; foiling?: string; pitch?: number; collector_number?: string; tcg_low?: number; tcg_market?: number } }>,
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
  };
}

export function summarizeDecks(
  decks: Array<{ publicId?: string; name: string; format?: string; heroDisplayName?: string; heroName?: string }>,
): QuickActionResult {
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

  return {
    title: `Deck: ${deck.name}${deck.format ? ` (${deck.format})` : ''}`,
    lines,
    context: `The user's deck "${deck.name}"${deck.heroName ? `, hero ${deck.heroName}` : ''}${deck.format ? `, format ${deck.format}` : ''}. ${colorSummary ? `Maindeck colors: ${colors.red} red / ${colors.yellow} yellow / ${colors.blue} blue. ` : ''}${contextParts.join('. ') || 'Empty deck.'}`,
    ...(viewCards.length ? { cards: viewCards, cardsSubtitle: 'Full decklist' } : {}),
  };
}

export function summarizeBinderCards(
  binderName: string,
  cards: Array<{ display_name?: string; name?: string; quantity?: number; forTrade?: boolean; set?: string; foiling?: string; pitch?: number; printingDetails?: { set?: string; foiling?: string; pitch?: number } }>,
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
  };
}

export interface SearchResultsCard {
  rows: CardLine[];
  total: number;
  shown: number;
}

const PITCH_LABEL: Record<number, string> = { 1: 'red', 2: 'yellow', 3: 'blue' };

/**
 * Parses search_printings structuredContent (the token-bypass channel) into
 * compact inline result rows: the full projected printing list already
 * arrives in the browser with every AI search — this just renders it.
 * Rows feed the rail (hover preview + add-to-binder/wants via printing_id).
 */
export function parseSearchResults(structured: any, maxRows = 20): SearchResultsCard | null {
  const first = structured?.results?.[0];
  if (!first || !Array.isArray(first.printings) || first.printings.length === 0) return null;

  const rows: CardLine[] = first.printings.slice(0, maxRows).map((p: any) => {
    const price = typeof p.price === 'number' ? ` · $${p.price.toFixed(2)}` : '';
    return {
      text: `${p.name} — ${String(p.set ?? '').toUpperCase()} ${p.collector_number ?? ''} · ${p.rarity ?? '?'}${price}`,
      pitch: typeof p.pitch === 'number' ? p.pitch : undefined,
      ...(typeof p.printing_count === 'number' && p.printing_count > 1 ? { printingCount: p.printing_count } : {}),
      preview: {
        imageUrl: getCardImageUrl({ printingId: p.printing_id }),
        name: p.name,
        printingId: p.printing_id,
        priceLow: typeof p.price === 'number' ? p.price : undefined,
      },
    };
  });

  return { rows, total: first.total ?? first.printings.length, shown: rows.length };
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
 * so card names Fabby mentions in its answer can hover-preview in the rail —
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
    id: 'decks-to-beat',
    label: 'Decks to beat',
    run: async () => {
      // Featured tournament decks — same endpoint the get_decks_to_beat MCP
      // tool wraps ({success, data: {decks}}). Public data, instant.
      const response = await fetch('/api/decks/community?featured=true&limit=25', { credentials: 'include' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.success) throw new Error(body?.error || 'Failed to load decks to beat');
      const decks: any[] = body?.data?.decks ?? [];
      const medal = (placing?: number) => (placing === 1 ? '🥇 ' : placing === 2 ? '🥈 ' : placing === 3 ? '🥉 ' : '');
      const lines: CardLine[] = decks.length === 0
        ? ['No featured decks yet.']
        : decks.map((d) => ({
            text: `${medal(d.placing)}${d.name}${d.eventName ? ` — ${d.eventName}` : ''}`,
            drill: { kind: 'deck' as const, id: d.publicId, name: d.name },
          }));
      return {
        title: `Decks to beat (${decks.length})`,
        lines,
        context: `Current featured tournament decks ("decks to beat"): ${
          decks.map((d) => `${d.name}${d.heroName ? ` [${d.heroName}]` : ''}${d.placing ? ` (#${d.placing})` : ''}`).join('; ') || 'none'
        }`,
      };
    },
  },
  {
    id: 'decks',
    label: 'My decks',
    run: async () => {
      // NOT getUserDecksBasic — it fetches /api/decks/basic, which 404s
      // (dead endpoint). GET /api/decks returns { success, decks } (legacy
      // shape, no `data` key — same handleResponse passthrough as wants).
      const result = await decksClient.getUserDecks(undefined, { limit: 50 });
      if (!result.success) throw new Error(result.error);
      const decks = (result.data as any)?.decks ?? [];
      return summarizeDecks(decks);
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

/** Fetch + format the deterministic archetype consensus for the picker. */
export async function runArchetypeConsensus(heroName: string, months: number, format?: string): Promise<QuickActionResult> {
  const params = new URLSearchParams({ heroName, months: String(months) });
  if (format) params.set('format', format);
  const response = await fetch(`/api/decks/archetype?${params}`, { credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.success) throw new Error(body?.error || 'Failed to compute consensus');
  return summarizeArchetypeConsensus(body.data);
}
