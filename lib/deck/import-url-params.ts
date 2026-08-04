// lib/deck/import-url-params.ts
//
// FaBrary-compatible URL deck import: /decks/import?name=&format=&hero=&cards=
// `cards` is comma-separated kebab-case card slugs (pitch-color suffix baked
// in, e.g. kiss-of-death-red), one entry per copy. The hero appears both in
// `hero` and as a card entry; the card copy is dropped here because the deck
// pipeline adds the hero at creation.
//
// Slugs map onto Talishar card ids (snake_case of the same tokens), which is
// what /api/cards/by-talishar-id resolves — so the preview page can batch-
// resolve every slug in one call. Known blind spot: double-faced cards use a
// double underscore in Talishar ids (comet_storm__shock) that a kebab slug
// cannot express; those surface as unresolved.

import { FORMAT_CODES } from '@/lib/fab-constants/formats';
import type { DeckFormat } from '@/lib/services/contracts/IDeckService';

export interface ImportUrlCard {
  slug: string;
  talisharId: string;
  quantity: number;
}

export interface ImportUrlRequest {
  name: string;
  format: DeckFormat | null;
  heroSlug: string;
  cards: ImportUrlCard[];
}

const DECK_FORMATS: DeckFormat[] = [
  'Classic Constructed', 'Silver Age', 'Blitz', 'Commoner',
  'Living Legend', 'Limited', 'Ultimate Pit Fight', 'Casual',
];

function resolveFormat(raw: string): DeckFormat | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  const aliased = FORMAT_CODES[key as keyof typeof FORMAT_CODES] ?? raw.trim();
  const match = DECK_FORMATS.find(f => f.toLowerCase() === aliased.toLowerCase());
  return match ?? null;
}

export function slugToTalisharId(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[-\s]/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/__/g, '_');
}

export function parseImportUrlParams(params: URLSearchParams): ImportUrlRequest {
  const name = (params.get('name') ?? '').trim();
  const format = resolveFormat(params.get('format') ?? '');
  const heroSlug = (params.get('hero') ?? '').trim();

  const slugs = params.getAll('cards')
    .flatMap(v => v.split(','))
    .map(s => s.trim())
    .filter(s => s && s !== heroSlug);

  const bySlug = new Map<string, ImportUrlCard>();
  for (const slug of slugs) {
    const existing = bySlug.get(slug);
    if (existing) existing.quantity += 1;
    else bySlug.set(slug, { slug, talisharId: slugToTalisharId(slug), quantity: 1 });
  }

  return { name, format, heroSlug, cards: Array.from(bySlug.values()) };
}

const PITCH_COLOR: Record<number, string> = { 1: 'red', 2: 'yellow', 3: 'blue' };

// Builds the paste-format text the existing FaBrary import pipeline consumes
// (parseFabraryDeck → importFabraryDeck), so URL import reuses its hero
// legality checks, categorization, and unresolved-card reporting.
export function synthesizeFabraryText(input: {
  name: string;
  format: string;
  heroName: string;
  cards: Array<{ displayName: string; pitch: number | null; quantity: number }>;
}): string {
  const lines = [
    `Name: ${input.name}`,
    `Hero: ${input.heroName}`,
    `Format: ${input.format}`,
    '',
  ];
  for (const card of input.cards) {
    const color = card.pitch != null ? PITCH_COLOR[card.pitch] : undefined;
    lines.push(`${card.quantity}x ${card.displayName}${color ? ` (${color})` : ''}`);
  }
  return lines.join('\n');
}
