// Dual-focus scope helpers (pure; unit-tested in scope-context.test.ts).
//
// The manual surface decides WHAT Volzar is asked about: the item on top of
// the workspace stack is the focus, optionally narrowed by a pitch/text
// filter. The context is DERIVED from that focus at send time (not queued as
// a snapshot when the item was opened), so manual edits and narrowing reach
// the model, and an unchanged focus costs zero tokens on later turns.

import type { CardRow } from './quick-actions';

export interface ScopeFilter {
  /** Pitch values to keep (1 red / 2 yellow / 3 blue); empty = any. */
  pitches: number[];
  /** Words that must all appear in the card's name or type line. */
  text: string;
}

export const EMPTY_SCOPE_FILTER: ScopeFilter = { pitches: [], text: '' };

type Section = { title: string; count: number; rows: CardRow[] };

/** The slice of a data item the scope helpers read. */
export interface ScopeItem {
  title: string;
  /** The AI context built by the item's drill/action (absent on info cards). */
  context?: string;
  tableRows?: CardRow[];
  tableSections?: Section[];
}

export function isScopeFilterActive(f: ScopeFilter): boolean {
  return f.pitches.length > 0 || f.text.trim().length > 0;
}

function rowMatches(row: CardRow, f: ScopeFilter): boolean {
  if (f.pitches.length > 0 && !(row.pitch !== undefined && f.pitches.includes(row.pitch))) return false;
  const words = f.text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${row.name} ${row.type ?? ''}`.toLowerCase();
  return words.every((w) => haystack.includes(w));
}

const qtySum = (rows: CardRow[]) => rows.reduce((n, r) => n + (r.qty ?? 1), 0);

/**
 * The item as the filter shows it: matching rows only (same row objects, so
 * the ±/swap handlers keep working), emptied sections dropped, section counts
 * recomputed by quantity. Identity when the filter is inactive.
 */
export function narrowItem<T extends ScopeItem>(item: T, f: ScopeFilter): T {
  if (!isScopeFilterActive(f)) return item;
  if (item.tableSections) {
    const tableSections = item.tableSections
      .map((s) => {
        const rows = s.rows.filter((r) => rowMatches(r, f));
        return { ...s, rows, count: qtySum(rows) };
      })
      .filter((s) => s.rows.length > 0);
    return { ...item, tableSections };
  }
  if (item.tableRows) return { ...item, tableRows: item.tableRows.filter((r) => rowMatches(r, f)) };
  return item;
}

const allRows = (item: ScopeItem): CardRow[] | null =>
  item.tableSections ? item.tableSections.flatMap((s) => s.rows) : item.tableRows ?? null;

/** Cards shown vs total (by quantity); null for items without card rows. */
export function scopeCardCounts(item: ScopeItem, f: ScopeFilter): { shown: number; total: number } | null {
  const rows = allRows(item);
  if (!rows) return null;
  return { shown: qtySum(allRows(narrowItem(item, f)) ?? []), total: qtySum(rows) };
}

const PITCH_NAME: Record<number, string> = { 1: 'red', 2: 'yellow', 3: 'blue' };

export function describeScopeFilter(f: ScopeFilter): string {
  const parts: string[] = [];
  if (f.pitches.length > 0) {
    const names = [...f.pitches].sort((a, b) => a - b).map((p) => PITCH_NAME[p] ?? `pitch ${p}`);
    parts.push(`${names.join(' or ')} pitch`);
  }
  const text = f.text.trim();
  if (text) parts.push(`matching "${text}"`);
  return parts.join(', ');
}

/** What rides the next turn for the current focus. */
export interface Scope {
  /** Ledger key: the item's title, suffixed for a narrowed subset. */
  key: string;
  title: string;
  context: string;
  narrowed: boolean;
}

const describeRow = (r: CardRow): string => {
  const meta = [r.pitch !== undefined ? `p${r.pitch}` : '', r.type ?? ''].filter(Boolean).join(', ');
  return `${r.qty ?? 1}× ${r.name}${meta ? ` (${meta})` : ''}${r.forTrade ? ' [for trade]' : ''}`;
};

/**
 * The scope for an item under a filter. Unfiltered → the item's own full
 * context. Filtered → a self-describing subset built from the visible rows
 * ONLY (a 12-card slice of an 800-card binder sends 12 cards, not 800).
 */
export function buildScope(item: ScopeItem, f: ScopeFilter): Scope | null {
  const counts = isScopeFilterActive(f) ? scopeCardCounts(item, f) : null;
  if (!counts) {
    if (!item.context) return null;
    return { key: item.title, title: item.title, context: item.context, narrowed: false };
  }
  const shown = narrowItem(item, f);
  const body = shown.tableSections
    ? shown.tableSections.map((s) => `${s.title}: ${s.rows.map(describeRow).join('; ')}`).join('. ')
    : (shown.tableRows ?? []).map(describeRow).join('; ');
  const context = `The user narrowed "${item.title}" to a subset (filter: ${describeScopeFilter(f)}; `
    + `${counts.shown} of ${counts.total} cards) and is asking about THESE cards specifically — `
    + `${body || 'no cards match the filter'}`;
  return { key: `${item.title}|narrowed`, title: item.title, context, narrowed: true };
}

/** What has already been sent this conversation, so nothing is sent twice. */
export interface FocusLedger {
  /** Scope key → the exact context last sent for it. */
  sent: Record<string, string>;
  /** The scope key that rode (or was pointed at by) the previous turn. */
  lastFocusKey: string | null;
}

export const EMPTY_FOCUS_LEDGER: FocusLedger = { sent: {}, lastFocusKey: null };

/**
 * Decide what the current focus contributes to the next user turn:
 *  - never sent            → header + full context
 *  - changed since sent    → header ("replaces the earlier version") + context
 *  - unchanged, same focus → nothing (zero tokens)
 *  - unchanged, focus moved away and came back → a one-line pointer
 * Returns the next ledger; the input ledger is not mutated.
 */
export function planFocusContext(scope: Scope | null, ledger: FocusLedger): { lines: string[]; ledger: FocusLedger } {
  if (!scope) return { lines: [], ledger: { ...ledger, lastFocusKey: null } };
  const previous = ledger.sent[scope.key];
  const next: FocusLedger = { sent: { ...ledger.sent, [scope.key]: scope.context }, lastFocusKey: scope.key };
  if (previous === scope.context) {
    if (ledger.lastFocusKey === scope.key) return { lines: [], ledger: next };
    return {
      lines: [`[Focus: the user is now looking at "${scope.title}" again — unchanged from when it was shared earlier in this conversation.]`],
      ledger: next,
    };
  }
  if (scope.narrowed) {
    return { lines: [`[Focus — a narrowed view of "${scope.title}":]`, scope.context], ledger: next };
  }
  const header = previous === undefined
    ? `[Focus — what the user is looking at right now, "${scope.title}":]`
    : `[Focus — "${scope.title}" changed since it was last shared; this replaces the earlier version:]`;
  return { lines: [header, scope.context], ledger: next };
}
