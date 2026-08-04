// lib/browse/import-url-prefill.ts
//
// /browse?cards=…&binder=… — prefill the bulk-import staging list from a link.
// Card tokens use the same grammar as /decks/import (Talishar ids or kebab
// slugs, one entry per copy). Quantities are netted against the signed-in
// user's card-level ownership (any printing variant in any binder counts),
// so the staged list is "what you're missing", not the raw list.

import { parseImportUrlParams, type ImportUrlCard } from '@/lib/deck/import-url-params';

export interface BrowsePrefillParams {
  cards: ImportUrlCard[];
  binderSlug: string;
}

export function parseBrowsePrefillParams(params: URLSearchParams): BrowsePrefillParams {
  return {
    cards: parseImportUrlParams(params).cards,
    binderSlug: (params.get('binder') ?? '').trim(),
  };
}

export interface PrefillCardInfo {
  displayName: string;
  pitch: number | null;
  cardUniqueId: string;
}

export interface PrefillLine {
  displayName: string;
  pitch: number | null;
  quantity: number;
}

export interface PrefillPlan {
  /** Cards still needed after ownership is deducted (net quantity > 0). */
  lines: PrefillLine[];
  /** Cards fully covered by the user's collection. */
  skipped: Array<{ displayName: string; requested: number; owned: number }>;
  /** Talishar ids with no card behind them. */
  unresolved: string[];
  summary: { requested: number; owned: number; toAdd: number };
}

export function computePrefillPlan(
  cards: ImportUrlCard[],
  lookup: Record<string, PrefillCardInfo>,
  ownedByCard: Record<string, number>,
): PrefillPlan {
  const lines: PrefillLine[] = [];
  const skipped: PrefillPlan['skipped'] = [];
  const unresolved: string[] = [];
  const summary = { requested: 0, owned: 0, toAdd: 0 };

  // Owned copies are consumed as tokens are processed, so two tokens that
  // resolve to the same card can't both deduct the same owned copy.
  const remainingOwned = new Map<string, number>();

  for (const card of cards) {
    const info = lookup[card.talisharId];
    if (!info) {
      unresolved.push(card.talisharId);
      continue;
    }

    if (!remainingOwned.has(info.cardUniqueId)) {
      remainingOwned.set(info.cardUniqueId, ownedByCard[info.cardUniqueId] ?? 0);
    }
    const available = remainingOwned.get(info.cardUniqueId)!;
    const deducted = Math.min(card.quantity, available);
    remainingOwned.set(info.cardUniqueId, available - deducted);
    const net = card.quantity - deducted;

    summary.requested += card.quantity;
    summary.owned += deducted;
    summary.toAdd += net;

    if (net > 0) {
      lines.push({ displayName: info.displayName, pitch: info.pitch, quantity: net });
    } else {
      skipped.push({
        displayName: info.displayName,
        requested: card.quantity,
        owned: ownedByCard[info.cardUniqueId] ?? 0,
      });
    }
  }

  return { lines, skipped, unresolved, summary };
}

/**
 * Whether the one-shot prefill effect may fire. AuthContext sets `user` in an
 * effect AFTER the session resolves, so `status === 'authenticated'` with no
 * user object is a transient frame — firing there would silently skip
 * ownership netting (the bug this guards against).
 */
export function isPrefillReady(input: {
  cardCount: number;
  sessionStatus: 'loading' | 'authenticated' | 'unauthenticated';
  hasUser: boolean;
}): boolean {
  if (input.cardCount === 0) return false;
  if (input.sessionStatus === 'loading') return false;
  if (input.sessionStatus === 'authenticated' && !input.hasUser) return false;
  return true;
}

const PITCH_COLOR: Record<number, string> = { 1: 'red', 2: 'yellow', 3: 'blue' };

/** Card-list text for the existing bulk-search pipeline: "2x Name (red)". */
export function toCardListText(lines: PrefillLine[]): string {
  return lines
    .map(l => {
      const color = l.pitch != null ? PITCH_COLOR[l.pitch] : undefined;
      return `${l.quantity}x ${l.displayName}${color ? ` (${color})` : ''}`;
    })
    .join('\n');
}
