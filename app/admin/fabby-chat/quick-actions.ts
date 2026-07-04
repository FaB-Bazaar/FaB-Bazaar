// Quick actions for the Fabby chat: deterministic reads that need zero AI
// tokens. "Buttons for the known, chat for the unknown" — listing binders /
// wants / decks is a direct client-service call rendered as a data card, not
// an LLM tool round-trip (~25k tokens saved per lookup).
//
// Each action also produces a compact `context` string. It is NOT sent
// anywhere when the action runs — it's queued, and attached to the NEXT
// free-text message so follow-ups like "which is worth the most?" work.
// Tokens are only spent if the user actually asks an AI question.

import { bindersClient, wantsClient, decksClient } from '@/lib/client';

export interface QuickActionResult {
  title: string;
  lines: string[];
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

export function summarizeBinders(binders: Array<{ name: string; slug?: string | null }>): QuickActionResult {
  const lines = binders.length === 0
    ? ['No binders yet.']
    : binders.map((b) => (b.slug ? `${b.name} (${b.slug})` : b.name));
  return {
    title: `Your binders (${binders.length})`,
    lines,
    context: `The user's binders (name, slug): ${binders.map((b) => `${b.name}${b.slug ? ` [${b.slug}]` : ''}`).join('; ') || 'none'}`,
  };
}

export function summarizeWants(result: {
  items: Array<{ display_name?: string; name?: string; quantity: number; priority: string }>;
  total: number;
}): QuickActionResult {
  const lines = result.items.length === 0
    ? ['Your wants list is empty.']
    : result.items.map((w) => `${w.quantity}× ${w.display_name || w.name || 'Unknown card'} (${w.priority})`);
  if (result.total > result.items.length) {
    lines.push(`…and ${result.total - result.items.length} more`);
  }
  return {
    title: `Your wants (${result.total})`,
    lines,
    context: `The user's wants list (qty× name, priority): ${
      result.items.map((w) => `${w.quantity}× ${w.display_name || w.name} (${w.priority})`).join('; ') || 'empty'
    }${result.total > result.items.length ? `; plus ${result.total - result.items.length} more not shown` : ''}`,
  };
}

export function summarizeDecks(decks: Array<{ name: string; format?: string; heroDisplayName?: string }>): QuickActionResult {
  const lines = decks.length === 0
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
// Action registry (thin client-service wiring)
// ---------------------------------------------------------------------------

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'binders',
    label: 'My binders',
    run: async () => {
      const result = await bindersClient.getUserBinders();
      if (!result.success) throw new Error(result.error);
      return summarizeBinders(result.data.binders);
    },
  },
  {
    id: 'wants',
    label: 'My wants',
    run: async () => {
      const result = await wantsClient.getUserWants(undefined, { limit: 25 });
      if (!result.success) throw new Error(result.error);
      return summarizeWants(result.data);
    },
  },
  {
    id: 'decks',
    label: 'My decks',
    run: async () => {
      const result = await decksClient.getUserDecksBasic();
      if (!result.success) throw new Error(result.error);
      return summarizeDecks(result.data);
    },
  },
];
