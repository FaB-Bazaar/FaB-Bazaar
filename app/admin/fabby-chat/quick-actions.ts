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

export type CardLine = string | {
  text: string;
  drill?: { kind: 'binder' | 'deck'; id: string; name: string };
  preview?: CardPreview;
};

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
  cards: Array<{ display_name?: string; name?: string; quantity?: number; priority?: string }>,
): QuickActionResult {
  const label = (c: { display_name?: string; name?: string }) => c.display_name || c.name || 'Unknown card';
  const lines: CardLine[] = cards.length === 0
    ? ['Your wants list is empty.']
    : cards.map((c) => ({
        text: `${c.quantity ?? 1}× ${label(c)}${c.priority ? ` (${c.priority})` : ''}`,
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
  printingDetails?: { display_name?: string; name?: string; pitch?: number; image_url?: string };
}

export function summarizeDeckContents(deck: {
  name: string;
  format?: string;
  heroName?: string;
  hero?: DeckCard[];
  equipment?: DeckCard[];
  maindeck?: DeckCard[];
}): QuickActionResult {
  const label = (c: DeckCard) => c.printingDetails?.display_name || c.printingDetails?.name || 'Unknown card';
  const cardLine = (c: DeckCard): CardLine => ({
    text: `${c.quantity ?? 1}× ${label(c)}${c.printingDetails?.pitch ? ` (pitch ${c.printingDetails.pitch})` : ''}`,
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
  if (lines.length === 0) lines.push('This deck is empty.');

  return {
    title: `Deck: ${deck.name}${deck.format ? ` (${deck.format})` : ''}`,
    lines,
    context: `The user's deck "${deck.name}"${deck.heroName ? `, hero ${deck.heroName}` : ''}${deck.format ? `, format ${deck.format}` : ''}. ${contextParts.join('. ') || 'Empty deck.'}`,
  };
}

export function summarizeBinderCards(
  binderName: string,
  cards: Array<{ display_name?: string; name?: string; quantity?: number; forTrade?: boolean }>,
  totalQuantity?: number,
): QuickActionResult {
  const label = (c: { display_name?: string; name?: string }) => c.display_name || c.name || 'Unknown card';
  const lines: CardLine[] = cards.length === 0
    ? ['This binder is empty.']
    : cards.map((c) => ({
        text: `${c.quantity ?? 1}× ${label(c)}${c.forTrade ? ' · for trade' : ''}`,
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
    const pitch = PITCH_LABEL[p.pitch as number];
    const price = typeof p.price === 'number' ? ` · $${p.price.toFixed(2)}` : '';
    return {
      text: `${p.name}${pitch ? ` (${pitch})` : ''} — ${String(p.set ?? '').toUpperCase()} ${p.collector_number ?? ''} · ${p.rarity ?? '?'}${price}`,
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
  return summarizeDeckContents(result.data as any);
}

/** Dispatch a drill target from a clicked line. */
export function runDrill(drill: { kind: 'binder' | 'deck'; id: string; name: string }): Promise<QuickActionResult> {
  return drill.kind === 'binder' ? runBinderDrill(drill.id, drill.name) : runDeckDrill(drill.id);
}
