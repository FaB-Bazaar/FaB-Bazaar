// Deck versions: an immutable copy of a deck's cards, saved when the owner asks
// for one (the `deck_versions` table). The live deck stays the working copy.
// This module is the pure half — the card shape a version stores, the key that
// tells two lists apart, and the comparison the Versions view shows. Safe to
// import from the browser; the service does the hashing and the SQL.

import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService'

export const VERSION_ZONES = ['hero', 'equipment', 'maindeck', 'inventory', 'benched', 'tokens'] as const
export type VersionZone = (typeof VERSION_ZONES)[number]

/** Same wording as the deck list export (lib/deck/deck-export-text). */
export const VERSION_ZONE_LABEL: Record<VersionZone, string> = {
  hero: 'Hero',
  equipment: 'Arena cards',
  maindeck: 'Deck cards',
  inventory: 'Sideboard',
  benched: 'Bench',
  tokens: 'Tokens',
}

export interface VersionCard {
  printingId: string
  cardUniqueId: string | null
  /** The card's name when the version was saved — kept so an old version still reads if a printing goes away. */
  name: string
  pitch: number | null
  quantity: number
  category: VersionZone
}

export interface DeckVersionSnapshot {
  name: string
  format: string | null
  heroName: string | null
  cards: VersionCard[]
}

export interface DeckVersionSummary {
  versionNumber: number
  label: string | null
  createdAt: string
  counts: Record<VersionZone, number>
}

export interface DeckVersion extends DeckVersionSummary {
  snapshot: DeckVersionSnapshot
}

export const MAX_VERSION_LABEL_LENGTH = 80

/** What the service answers when the caller is not the deck's owner or a co-owner (routes map it to 403). */
export const DECK_VERSION_NOT_EDITABLE = 'Deck not found or not editable'
/** What the service answers for a deck with no cards (routes map it to 400). */
export const DECK_VERSION_EMPTY = 'This deck has no cards to save'

/**
 * The HTTP answer for a failed versions call. Only the two refusals a person
 * can act on keep their wording; anything else (a database error) becomes a
 * plain 500 so its text never reaches the page.
 */
export function deckVersionFailure(error: string): { status: number; error: string } {
  if (error === DECK_VERSION_NOT_EDITABLE) return { status: 403, error }
  if (error === DECK_VERSION_EMPTY) return { status: 400, error }
  return { status: 500, error: 'Something went wrong with deck versions. Please try again.' }
}

const zoneIndex = (zone: VersionZone) => VERSION_ZONES.indexOf(zone)

/** One row per printing per zone, empty rows dropped, in a fixed order. */
export function normalizeVersionCards(rows: VersionCard[]): VersionCard[] {
  const merged = new Map<string, VersionCard>()
  for (const row of rows) {
    if (!(row.quantity > 0)) continue
    const key = `${row.category}|${row.printingId}`
    const seen = merged.get(key)
    if (seen) seen.quantity += row.quantity
    else merged.set(key, { ...row })
  }
  return [...merged.values()].sort((a, b) =>
    zoneIndex(a.category) - zoneIndex(b.category)
    || (a.pitch ?? 0) - (b.pitch ?? 0)
    || a.name.localeCompare(b.name)
    || a.printingId.localeCompare(b.printingId))
}

/**
 * What makes two lists the same list: which printings, in which zone, how
 * many. Names and the deck's title are left out, so renaming a deck is not a
 * new version.
 */
export function versionContentKey(cards: VersionCard[]): string {
  return normalizeVersionCards(cards)
    .map(c => `${c.category}:${c.printingId}:${c.quantity}`)
    .sort()
    .join('\n')
}

export function versionCounts(cards: VersionCard[]): Record<VersionZone, number> {
  const counts = Object.fromEntries(VERSION_ZONES.map(z => [z, 0])) as Record<VersionZone, number>
  for (const c of cards) counts[c.category] += c.quantity
  return counts
}

/** The live deck in the shape a version stores, so the two can be compared. */
export function deckToVersionCards(deck: DeckDTO): VersionCard[] {
  return VERSION_ZONES.flatMap(zone =>
    ((deck[zone] ?? []) as DeckPrintingDTO[]).map(card => ({
      printingId: card.printingId,
      cardUniqueId: card.printingDetails?.card_unique_id ?? null,
      name: card.printingDetails?.display_name || card.printingDetails?.name || card.printingId,
      pitch: card.printingDetails?.pitch ?? null,
      quantity: card.quantity ?? 1,
      category: zone,
    })))
}

export interface VersionChange { name: string; pitch: number | null; quantity: number }
export interface VersionZoneDiff { zone: VersionZone; label: string; added: VersionChange[]; removed: VersionChange[] }

// Tokens aren't part of the list a player registers.
const DIFF_ZONES: VersionZone[] = ['hero', 'equipment', 'maindeck', 'inventory', 'benched']

/**
 * What changed from `before` to `after`, zone by zone, by card name + pitch —
 * a different printing of the same card is not a change. Zones with no change
 * are left out.
 */
export function diffVersionCards(before: VersionCard[], after: VersionCard[]): VersionZoneDiff[] {
  const totals = (cards: VersionCard[], zone: VersionZone) => {
    const m = new Map<string, VersionChange>()
    for (const c of cards) {
      if (c.category !== zone) continue
      const key = `${c.name}|${c.pitch ?? ''}`
      const cur = m.get(key) ?? { name: c.name, pitch: c.pitch ?? null, quantity: 0 }
      cur.quantity += c.quantity
      m.set(key, cur)
    }
    return m
  }
  const order = (x: VersionChange, y: VersionChange) => x.name.localeCompare(y.name) || (x.pitch ?? 0) - (y.pitch ?? 0)

  const out: VersionZoneDiff[] = []
  for (const zone of DIFF_ZONES) {
    const a = totals(before, zone), b = totals(after, zone)
    const added: VersionChange[] = [], removed: VersionChange[] = []
    for (const key of new Set([...a.keys(), ...b.keys()])) {
      const was = a.get(key)?.quantity ?? 0, now = b.get(key)?.quantity ?? 0
      const base = (a.get(key) ?? b.get(key))!
      if (now > was) added.push({ name: base.name, pitch: base.pitch, quantity: now - was })
      if (was > now) removed.push({ name: base.name, pitch: base.pitch, quantity: was - now })
    }
    if (added.length > 0 || removed.length > 0) {
      out.push({ zone, label: VERSION_ZONE_LABEL[zone], added: added.sort(order), removed: removed.sort(order) })
    }
  }
  return out
}

/** The optional note on a saved version: one line, at most 80 characters. */
export function sanitizeVersionLabel(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const label = input.replace(/\s+/g, ' ').trim().slice(0, MAX_VERSION_LABEL_LENGTH).trim()
  return label || null
}
