// lib/scan/scan-session.ts — pure state for the /scan page (no React, no DOM).
// A queue of photographed cards; each is identified by /api/scan/identify,
// the user confirms/changes the printing + quantity, then batches are added
// to a binder. Kept pure so it's unit-testable under the node project.
import type { ScanCandidate, ScanPrinting, IdentifyResult } from '@/lib/services/postgres/scan/PostgresScanService';
import type { PitchHint } from '@/lib/scan/image-hash';

export type { ScanCandidate, ScanPrinting };

export type ScanItemStatus = 'identifying' | 'ready' | 'no-match' | 'error' | 'added';

export interface ScanItem {
  id: string;
  previewUrl: string;
  status: ScanItemStatus;
  candidates: ScanCandidate[];
  bestDistance: number | null;
  pitchHint: PitchHint | null;
  chosenPrintingId: string | null;
  quantity: number;
  error?: string;
}

export interface ScanState {
  items: ScanItem[];
}

export const initialScanState: ScanState = { items: [] };

// Combined Hamming distance bands (0..256 = 2×art + phash + dhash), from
// scripts/scan-eval.ts on the PEN+SEA index (2026-09): correct matches p90 40
// (normal) / 64 (harsh) / 54 (table scene), max 76; wrong matches start at 68.
// Re-measure after changing the hash pipeline or after the full-index build.
export const CONFIDENT_MAX_DISTANCE = 44;
export const PLAUSIBLE_MAX_DISTANCE = 66;
export type MatchConfidence = 'confident' | 'plausible' | 'weak';
export function matchConfidence(distance: number | null): MatchConfidence {
  if (distance === null) return 'weak';
  if (distance <= CONFIDENT_MAX_DISTANCE) return 'confident';
  if (distance <= PLAUSIBLE_MAX_DISTANCE) return 'plausible';
  return 'weak';
}

export type ScanAction =
  | { type: 'queued'; id: string; previewUrl: string }
  | { type: 'identified'; id: string; candidates: ScanCandidate[]; bestDistance: number | null; pitchHint: PitchHint | null }
  | { type: 'failed'; id: string; error: string }
  | { type: 'choose'; id: string; printingId: string }
  | { type: 'quantity'; id: string; quantity: number }
  | { type: 'remove'; id: string }
  | { type: 'added'; ids: string[] }
  | { type: 'clearAdded' }
  /** An item identified on a paired phone, delivered over SSE (idempotent on id). */
  | { type: 'remote'; id: string; previewUrl: string; candidates: ScanCandidate[]; bestDistance: number | null; pitchHint: PitchHint | null }
  /** One photo held several cards: replace the queued item with one item per card (in order). */
  | { type: 'split'; id: string; cards: Array<{ id: string; previewUrl: string | null; candidates: ScanCandidate[]; bestDistance: number | null; pitchHint: PitchHint | null }> };

/** Scale (w,h) so the longer edge is at most `max`; never upscale. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const k = max / longest;
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

// Foil siblings share one render, so they tie on distance; most scanned
// cards are non-foil, so break the tie toward standard foiling.
const FOILING_PREFERENCE: Record<string, number> = { s: 0, r: 1, c: 2 };

/** First card group's best-matched English printing (non-foil on ties), else its first printing. */
export function defaultPrintingChoice(candidate: ScanCandidate): string | null {
  const card = candidate.cards[0];
  if (!card || card.printings.length === 0) return null;
  const en = card.printings.filter(p => p.language === 'en');
  if (en.length === 0) return card.printings[0].printingId;
  const best = Math.min(...en.map(p => p.distance ?? Number.POSITIVE_INFINITY));
  const tied = en.filter(p => (p.distance ?? Number.POSITIVE_INFINITY) === best);
  tied.sort((a, b) => (FOILING_PREFERENCE[a.foiling.toLowerCase()] ?? 9) - (FOILING_PREFERENCE[b.foiling.toLowerCase()] ?? 9));
  return tied[0].printingId;
}

function update(state: ScanState, id: string, fn: (item: ScanItem) => ScanItem): ScanState {
  return { items: state.items.map(i => (i.id === id ? fn(i) : i)) };
}

export function scanReducer(state: ScanState, action: ScanAction): ScanState {
  switch (action.type) {
    case 'queued':
      return {
        items: [...state.items, {
          id: action.id, previewUrl: action.previewUrl, status: 'identifying', candidates: [],
          bestDistance: null, pitchHint: null, chosenPrintingId: null, quantity: 1,
        }],
      };
    case 'identified':
      return update(state, action.id, i => ({
        ...i,
        candidates: action.candidates,
        bestDistance: action.bestDistance,
        pitchHint: action.pitchHint,
        chosenPrintingId: action.candidates[0] ? defaultPrintingChoice(action.candidates[0]) : null,
        status: action.candidates.length > 0 ? 'ready' : 'no-match',
        error: undefined,
      }));
    case 'failed':
      return update(state, action.id, i => ({ ...i, status: 'error', error: action.error }));
    case 'choose':
      return update(state, action.id, i => ({ ...i, chosenPrintingId: action.printingId, status: i.status === 'no-match' ? 'ready' : i.status }));
    case 'quantity':
      return update(state, action.id, i => ({ ...i, quantity: Math.max(1, Math.min(99, Math.floor(action.quantity) || 1)) }));
    case 'remove':
      return { items: state.items.filter(i => i.id !== action.id) };
    case 'added': {
      const ids = new Set(action.ids);
      return { items: state.items.map(i => (ids.has(i.id) ? { ...i, status: 'added' as const } : i)) };
    }
    case 'clearAdded':
      return { items: state.items.filter(i => i.status !== 'added') };
    case 'split': {
      const at = state.items.findIndex(i => i.id === action.id);
      if (at === -1) return state;
      const photo = state.items[at];
      const replacements: ScanItem[] = action.cards.map(c => ({
        id: c.id, previewUrl: c.previewUrl || photo.previewUrl, status: c.candidates.length > 0 ? 'ready' : 'no-match',
        candidates: c.candidates, bestDistance: c.bestDistance, pitchHint: c.pitchHint,
        chosenPrintingId: c.candidates[0] ? defaultPrintingChoice(c.candidates[0]) : null, quantity: 1,
      }));
      return { items: [...state.items.slice(0, at), ...replacements, ...state.items.slice(at + 1)] };
    }
    case 'remote': {
      if (state.items.some(i => i.id === action.id)) return state;
      return {
        items: [...state.items, {
          id: action.id, previewUrl: action.previewUrl, status: action.candidates.length > 0 ? 'ready' : 'no-match',
          candidates: action.candidates, bestDistance: action.bestDistance, pitchHint: action.pitchHint,
          chosenPrintingId: action.candidates[0] ? defaultPrintingChoice(action.candidates[0]) : null, quantity: 1,
        }],
      };
    }
    default:
      return state;
  }
}

/** Binder add rows for every ready item with a chosen printing, merged per printing. */
export function pendingAdds(state: ScanState): Array<{ printingId: string; quantity: number }> {
  const out = new Map<string, number>();
  for (const i of state.items) {
    if (i.status !== 'ready' || !i.chosenPrintingId) continue;
    out.set(i.chosenPrintingId, (out.get(i.chosenPrintingId) ?? 0) + i.quantity);
  }
  return [...out.entries()].map(([printingId, quantity]) => ({ printingId, quantity }));
}

/**
 * Deskew is do-no-harm: a photo that was deskewed is ALSO matched flat, and
 * the closer result wins (a false quad scores far above a real match).
 * Ties keep the first argument.
 */
export function pickBetterIdentification<T extends { result: IdentifyResult }>(a: T, b: T): T {
  const da = a.result.bestDistance ?? Number.POSITIVE_INFINITY;
  const db = b.result.bestDistance ?? Number.POSITIVE_INFINITY;
  return db < da ? b : a;
}

/** Ids of the items pendingAdds() would submit. */
export function readyItemIds(state: ScanState): string[] {
  return state.items.filter(i => i.status === 'ready' && i.chosenPrintingId).map(i => i.id);
}
