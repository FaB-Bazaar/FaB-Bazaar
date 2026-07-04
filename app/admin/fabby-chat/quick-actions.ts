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

/** A display line; binder lines carry a drill target for one-click contents. */
export type CardLine = string | { text: string; drill: { binderId: string; name: string } };

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
        drill: { binderId: b._id, name: b.name },
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
    : cards.map((c) => `${c.quantity ?? 1}× ${label(c)}${c.priority ? ` (${c.priority})` : ''}`);
  return {
    title: `Your wants (${cards.length})`,
    lines,
    context: `The user's wants list (qty× name, priority): ${
      cards.map((c) => `${c.quantity ?? 1}× ${label(c)}${c.priority ? ` (${c.priority})` : ''}`).join('; ') || 'empty'
    }`,
  };
}

export function summarizeDecks(
  decks: Array<{ name: string; format?: string; heroDisplayName?: string }>,
): QuickActionResult {
  const lines: CardLine[] = decks.length === 0
    ? ['No decks yet.']
    : decks.map((d) => `${d.name}${d.heroDisplayName ? ` — ${d.heroDisplayName}` : ''}${d.format ? ` (${d.format})` : ''}`);
  return {
    title: `Your decks (${decks.length})`,
    lines,
    context: `The user's decks (name — hero, format): ${
      decks.map((d) => `${d.name}${d.heroDisplayName ? ` — ${d.heroDisplayName}` : ''}${d.format ? ` (${d.format})` : ''}`).join('; ') || 'none'
    }`,
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
    : cards.map((c) => `${c.quantity ?? 1}× ${label(c)}${c.forTrade ? ' · for trade' : ''}`);
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
      const result = await decksClient.getUserDecksBasic();
      if (!result.success) throw new Error(result.error);
      const decks = Array.isArray(result.data) ? result.data : (result.data as any)?.decks ?? [];
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
