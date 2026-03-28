/**
 * card-pool-cache.ts
 *
 * Module-level cache for the legal card pool of a hero+format combination.
 * Lives outside React so it survives component unmounts, dialog open/close
 * cycles, and re-renders. Cleared only on full page navigation.
 *
 * Usage anywhere in the client:
 *   import { preloadCardPool, getCachedCards, getCachedAvailableTypes } from '@/lib/client/card-pool-cache';
 */

import { sortPrintings } from '@/lib/fab-constants';
import { getApiFormatCode } from '@/lib/format-constants';

// ─── Shared types ──────────────────────────────────────────────────────────────

export interface PrintingResult {
  printing_id: string;
  image_url?: string;
  set?: string;
  collector_number?: string;
  edition?: string;
  foiling?: string;
  rarity?: string;
  is_extended_art?: boolean;
  tcg_low?: number | null;
  tcg_market?: number | null;
  card_unique_id?: string;
  cardId?: string;
  display_name?: string;
  name?: string;
  types?: string[];
  pitch?: number | null;
  [key: string]: unknown;
}

export interface CardResult {
  unique_id: string;
  name: string;
  types: string[];
  pitch: number | null;
  printings: PrintingResult[];
}

export interface PoolParams {
  heroClasses: string[];
  heroTalents: string[];
  heroEssences: string[];
  format?: string;
}

// ─── Cache maps ───────────────────────────────────────────────────────────────

const availableTypesCache = new Map<string, Set<string>>();
const cardsByTypeCache    = new Map<string, CardResult[]>();
/** Track in-flight fetches so concurrent callers don't double-fetch */
const inflight = new Map<string, Promise<unknown>>();

// ─── Key helpers ──────────────────────────────────────────────────────────────

export function poolKey(p: PoolParams): string {
  return [
    [...p.heroClasses].sort().join(','),
    [...p.heroTalents].sort().join(','),
    [...p.heroEssences].sort().join(','),
    p.format ?? '',
  ].join('|');
}

export function cardKey(p: PoolParams, type: string): string {
  return poolKey(p) + '§' + type;
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

export function getCachedAvailableTypes(p: PoolParams): Set<string> | undefined {
  return availableTypesCache.get(poolKey(p));
}

export function getCachedCards(p: PoolParams, type: string): CardResult[] | undefined {
  return cardsByTypeCache.get(cardKey(p, type));
}

// ─── Write helpers (used by dialog after a fresh fetch) ───────────────────────

export function setCachedAvailableTypes(p: PoolParams, types: Set<string>): void {
  availableTypesCache.set(poolKey(p), types);
}

export function setCachedCards(p: PoolParams, type: string, cards: CardResult[]): void {
  cardsByTypeCache.set(cardKey(p, type), cards);
}

// ─── Internal: group raw printings into CardResult[] ─────────────────────────

function groupPrintings(printingsData: PrintingResult[]): CardResult[] {
  const map = new Map<string, CardResult>();
  for (const p of printingsData) {
    const id = (p.card_unique_id || p.cardId || p.display_name || p.name || '?') as string;
    if (!map.has(id)) {
      map.set(id, {
        unique_id: id,
        name: (p.display_name || p.name || 'Unknown') as string,
        types: ((p.types || []) as string[]).map(t => String(t).toLowerCase()),
        pitch: (p.pitch ?? null) as number | null,
        printings: [],
      });
    }
    map.get(id)!.printings.push(p);
  }
  const pitchOrder = (c: CardResult) => c.pitch == null ? 0 : c.pitch;
  return Array.from(map.values())
    .sort((a, b) => {
      const n = a.name.localeCompare(b.name);
      return n !== 0 ? n : pitchOrder(a) - pitchOrder(b);
    })
    .map(card => ({ ...card, printings: sortPrintings(card.printings) }));
}

// ─── Internal: build base URLSearchParams for a hero+format ──────────────────

function baseParams(p: PoolParams): URLSearchParams {
  const params = new URLSearchParams();
  if (p.heroClasses.length) params.set('heroClasses', p.heroClasses.join(','));
  if (p.heroTalents.length) params.set('heroTalents', p.heroTalents.join(','));
  if (p.heroEssences.length) params.set('heroEssences', p.heroEssences.join(','));
  if (p.format) {
    const fmt = getApiFormatCode(p.format);
    if (fmt) params.set('format', fmt);
  }
  params.set('show', 'all');
  return params;
}

// ─── Probe: determine which types have legal cards ────────────────────────────

export async function probeAvailableTypes(
  p: PoolParams,
  typeChips: { value: string; apiType: string }[],
): Promise<Set<string>> {
  const cached = getCachedAvailableTypes(p);
  if (cached) return cached;

  const key = 'probe|' + poolKey(p);
  if (inflight.has(key)) return inflight.get(key) as Promise<Set<string>>;

  const promise = (async () => {
    const base = baseParams(p);
    base.set('limit', '1');
    const results = await Promise.all(
      typeChips.map(chip => {
        const q = new URLSearchParams(base);
        q.set('types', chip.apiType);
        return fetch(`/api/printings/search?${q}`)
          .then(r => r.json())
          .then((data: { data?: { printings?: unknown[] } }) =>
            (data.data?.printings?.length ?? 0) > 0 ? chip.value : null)
          .catch(() => chip.value);
      }),
    );
    const available = new Set(results.filter(Boolean) as string[]);
    setCachedAvailableTypes(p, available);
    return available;
  })();

  inflight.set(key, promise);
  promise.finally(() => inflight.delete(key));
  return promise;
}

// ─── Fetch cards for a single type ────────────────────────────────────────────

export async function fetchTypeCards(
  p: PoolParams,
  apiType: string,
  chipValue: string,
): Promise<CardResult[]> {
  const cached = getCachedCards(p, chipValue);
  if (cached) return cached;

  const key = cardKey(p, chipValue);
  if (inflight.has(key)) return inflight.get(key) as Promise<CardResult[]>;

  const promise = (async () => {
    const params = baseParams(p);
    params.set('types', apiType);
    params.set('limit', '8000');
    params.set('sortBy', 'name');
    params.set('sortOrder', 'asc');
    const data: { success?: boolean; data?: { printings?: PrintingResult[] } } =
      await fetch(`/api/printings/search?${params}`).then(r => r.json());
    const cards = data.success && data.data?.printings
      ? groupPrintings(data.data.printings)
      : [];
    setCachedCards(p, chipValue, cards);
    return cards;
  })();

  inflight.set(key, promise);
  promise.finally(() => inflight.delete(key));
  return promise;
}

// ─── Preload: probe then fetch all available types in the background ──────────

export async function preloadCardPool(
  p: PoolParams,
  typeChips: { value: string; apiType: string }[],
): Promise<void> {
  if (!p.heroClasses.length && !p.heroTalents.length) return;

  const available = await probeAvailableTypes(p, typeChips);

  // Fetch all available types concurrently (fire-and-forget after probe)
  await Promise.all(
    typeChips
      .filter(chip => available.has(chip.value))
      .map(chip => fetchTypeCards(p, chip.apiType, chip.value)),
  );
}
