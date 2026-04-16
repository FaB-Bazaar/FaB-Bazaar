// app/api/mcp/tool/helpers.ts
// Shared server-side resolution helpers for MCP tool handlers.
// These fetch internal API routes so callers don't need separate tool calls.

import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

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

/**
 * Resolve a curated list by ID or name.
 * - If `idOrName` looks like a UUID it's used directly.
 * - Otherwise all lists are fetched and the first case-insensitive name match is used.
 * Returns { ok: true, list } or { ok: false, error }.
 */
export async function resolveList(
  idOrName: string,
  tokenToUse: string,
): Promise<{ ok: true; list: ResolvedList } | { ok: false; error: string }> {
  const API_BASE_URL = getMcpApiBaseUrl();

  // Heuristic: UUIDs are 36 chars with hyphens; short strings are names
  const looksLikeId = /^[0-9a-f-]{32,}$/i.test(idOrName);

  let listId = idOrName;

  if (!looksLikeId) {
    // Resolve name → ID
    const listRes = await mcpFetch(`${API_BASE_URL}/api/curated-lists`, {
      headers: { 'Authorization': `Bearer ${tokenToUse}` },
    });
    if (!listRes.ok) return { ok: false, error: `Failed to fetch curated lists (HTTP ${listRes.status}).` };
    const listData = await listRes.json();
    if (!listData.success) return { ok: false, error: listData.error || 'Could not load curated lists.' };

    const match = (listData.data || []).find(
      (l: any) => l.name?.toLowerCase() === idOrName.toLowerCase(),
    );
    if (!match) {
      const available = (listData.data || []).map((l: any) => l.name).join(', ');
      return { ok: false, error: `No curated list named "${idOrName}" found. Available: ${available}` };
    }
    listId = match.id;
  }

  // Fetch full list (includes cards with entry IDs)
  const res = await mcpFetch(`${API_BASE_URL}/api/curated-lists/${encodeURIComponent(listId)}`, {
    headers: { 'Authorization': `Bearer ${tokenToUse}` },
  });
  if (res.status === 404) return { ok: false, error: `List not found: ${listId}` };
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
