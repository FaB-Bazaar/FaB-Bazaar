// app/api/mcp/tool/helpers.ts
// Shared server-side resolution helpers for MCP tool handlers.
// These fetch internal API routes so callers don't need separate tool calls.

import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

// ─── Identifier shape detection ───────────────────────────────────────────────
// Curated list IDs are 21-char nanoids (e.g. "BTHFe31KkSTyhMSit_TEh").
// Printing IDs look like "wtr001" / "dyn043-cf".
// Human names contain spaces or obvious category words.

const NANOID_RE = /^[A-Za-z0-9_-]{10,30}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRINTING_ID_RE = /^[a-z]{3}\d{3}[a-z]?(-[a-z0-9]+)?$/i;

export type IdentifierShape = 'uuid' | 'nanoid' | 'printingId' | 'humanName' | 'unknown';

export function classifyIdentifier(value: string): IdentifierShape {
  if (!value) return 'unknown';
  const v = value.trim();
  if (UUID_RE.test(v)) return 'uuid';
  if (PRINTING_ID_RE.test(v)) return 'printingId';
  if (NANOID_RE.test(v) && /[A-Z]/.test(v) && /[a-z]/.test(v)) return 'nanoid';
  if (/\s/.test(v) || v.length > 30) return 'humanName';
  if (NANOID_RE.test(v)) return 'nanoid';
  return 'unknown';
}

export function looksLikeListId(value: string): boolean {
  const shape = classifyIdentifier(value);
  return shape === 'nanoid' || shape === 'uuid';
}

// ─── Deck resolution ──────────────────────────────────────────────────────────

export interface ResolvedDeck {
  publicId: string;
  name: string;
}

/**
 * Resolve a deck by name (case-insensitive) for the authenticated user.
 * Returns { ok: true, deck } or { ok: false, error }.
 */
export async function resolveDeckByName(
  deckName: string,
  tokenToUse: string,
): Promise<{ ok: true; deck: ResolvedDeck } | { ok: false; error: string }> {
  const API_BASE_URL = getMcpApiBaseUrl();
  const res = await mcpFetch(`${API_BASE_URL}/api/decks?limit=100`, {
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenToUse}` },
  });
  if (!res.ok) return { ok: false, error: `Failed to fetch deck list (HTTP ${res.status}).` };
  const data = await res.json();
  if (!data.success) return { ok: false, error: data.error || 'Could not load deck list.' };

  const deck = (data.decks || []).find((d: any) => d.name?.toLowerCase() === deckName.toLowerCase());
  if (!deck) {
    const available = (data.decks || []).map((d: any) => d.name).join(', ');
    return { ok: false, error: `No deck named "${deckName}" found. Available: ${available}` };
  }
  return { ok: true, deck: { publicId: deck.publicId, name: deck.name } };
}

// ─── Curated list resolution ──────────────────────────────────────────────────

export interface ResolvedList {
  id: string;
  name: string;
  cards: Array<{ id: string; printingId: string; displayName?: string }>;
}

export interface ResolveListOptions {
  /** Scopes name lookups to a single hero to disambiguate shared category names (e.g. "Equipment & Weapons"). */
  heroName?: string;
}

/**
 * Resolve a curated list by ID or name.
 * - If `idOrName` matches a nanoid/UUID shape it's used directly.
 * - Otherwise lists are fetched and filtered by case-insensitive name match
 *   (optionally scoped to `options.heroName`).
 * - Multiple name matches return an actionable error, never a silent pick.
 * Returns { ok: true, list } or { ok: false, error }.
 */
export async function resolveList(
  idOrName: string,
  tokenToUse: string,
  options: ResolveListOptions = {},
): Promise<{ ok: true; list: ResolvedList } | { ok: false; error: string }> {
  const API_BASE_URL = getMcpApiBaseUrl();

  let listId: string | null = looksLikeListId(idOrName) ? idOrName : null;

  if (!listId) {
    // Resolve name → ID
    const listRes = await mcpFetch(`${API_BASE_URL}/api/curated-lists`, {
      headers: { 'Authorization': `Bearer ${tokenToUse}` },
    });
    if (!listRes.ok) return { ok: false, error: `Failed to fetch curated lists (HTTP ${listRes.status}).` };
    const listData = await listRes.json();
    if (!listData.success) return { ok: false, error: listData.error || 'Could not load curated lists.' };

    const allLists = (listData.data || []) as Array<{ id: string; name: string; heroName?: string | null; isPublished?: boolean }>;

    const nameLower = idOrName.toLowerCase();
    const heroLower = options.heroName?.toLowerCase();

    let matches = allLists.filter(l => l.name?.toLowerCase() === nameLower);
    if (heroLower) {
      matches = matches.filter(l => (l.heroName ?? '').toLowerCase() === heroLower);
    }

    if (matches.length === 0) {
      const nearest = allLists
        .filter(l => l.name?.toLowerCase().includes(nameLower))
        .slice(0, 5)
        .map(l => `  • "${l.name}"${l.heroName ? ` (${l.heroName})` : ''} — id: ${l.id}`)
        .join('\n');
      const hint = nearest
        ? `\nDid you mean one of:\n${nearest}`
        : `\nCall list_curated_lists() to see all available list names and IDs.`;
      const scopeNote = heroLower ? ` (scoped to hero "${options.heroName}")` : '';
      return { ok: false, error: `No curated list named "${idOrName}"${scopeNote} found.${hint}` };
    }

    if (matches.length > 1) {
      const rendered = matches
        .map(l => `  • id: ${l.id} — hero: ${l.heroName ?? 'none'}${l.isPublished === false ? ' (draft)' : ''}`)
        .join('\n');
      return {
        ok: false,
        error:
          `Multiple lists named "${idOrName}" (${matches.length} matches):\n${rendered}\n` +
          `Pass \`listId\` directly, or pass \`heroName: "..."\` to disambiguate.`,
      };
    }

    listId = matches[0].id;
  }

  // Fetch full list (includes cards with entry IDs)
  const res = await mcpFetch(`${API_BASE_URL}/api/curated-lists/${encodeURIComponent(listId)}`, {
    headers: { 'Authorization': `Bearer ${tokenToUse}` },
  });
  if (res.status === 404) {
    return { ok: false, error: `List not found: ${listId}. Call list_curated_lists() to see valid IDs.` };
  }
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `Failed to fetch list (HTTP ${res.status}): ${text}` };
  }
  const result = await res.json();
  if (!result.success) return { ok: false, error: result.error || 'API returned an error.' };

  const list = result.data;
  return {
    ok: true,
    list: {
      id: list.id,
      name: list.name,
      cards: (list.cards || []).map((c: any) => ({
        id: c.id,
        printingId: c.printingId,
        displayName: c.displayName,
      })),
    },
  };
}

// ─── Shape-mismatch validation ────────────────────────────────────────────────
// Call at the top of each curation tool handler. Returns a clear error string
// when a param's value shape doesn't match its name, or null when OK.

export function validateListIdentifierParams(params: {
  listId?: string;
  listName?: string;
}): string | null {
  if (params.listId) {
    const shape = classifyIdentifier(params.listId);
    if (shape === 'humanName') {
      return `"${params.listId}" looks like a list name, not an ID. Pass it as \`listName\` instead (add \`heroName\` to disambiguate if multiple heroes share that name).`;
    }
    if (shape === 'printingId') {
      return `"${params.listId}" looks like a printing ID, not a list ID. List IDs are nanoids like "BTHFe31KkSTyhMSit_TEh".`;
    }
  }
  if (params.listName && looksLikeListId(params.listName)) {
    return `"${params.listName}" looks like a list ID, not a name. Retry with \`listId: "${params.listName}"\`.`;
  }
  return null;
}

export function validatePrintingIds(printingIds: string[] | undefined, paramName = 'printingIds'): string | null {
  if (!printingIds?.length) return null;
  // A printing_id is ALWAYS a 21-char nanoid (all 43,414 rows in the DB). Collector
  // numbers like "EVO249" / "dyn043-cf" live in a SEPARATE column and are NOT printing
  // IDs — they're the usual paste mistake. Card entry IDs share the nanoid shape, so
  // by shape alone we can only reject non-nanoids. (classifyIdentifier's 'printingId'
  // label is a legacy misnomer for the collector-number shape.)
  const bad = printingIds.filter(id => classifyIdentifier(id) !== 'nanoid');
  if (bad.length) {
    return (
      `${bad.length} value(s) in \`${paramName}\` look like collector numbers (e.g. "EVO249"), not printing IDs. ` +
      `A printing_id is a 21-char nanoid — look one up with \`search_printings\` (or fab://card-index). ` +
      `Bad: ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? '…' : ''}`
    );
  }
  return null;
}

export function validateCardEntryIds(entryIds: string[] | undefined): string | null {
  if (!entryIds?.length) return null;
  const bad = entryIds.filter(id => classifyIdentifier(id) === 'printingId');
  if (bad.length) {
    return (
      `${bad.length} value(s) in \`cardEntryIds\` look like printing IDs (e.g. "wtr001"), not card entry IDs. ` +
      `Card entry IDs come from the add_card_to_list response. If you meant printing IDs, pass them as \`printingIds\` instead. ` +
      `Bad: ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? '…' : ''}`
    );
  }
  return null;
}
