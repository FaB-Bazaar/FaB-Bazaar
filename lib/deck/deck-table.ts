// Deck v2 Table view: the deck as one sortable spreadsheet — one row per card
// per zone — so a highlight can lift its matches to the top instead of making
// the reader hunt through three masonry columns.

import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService'
import { cardTextMatches } from './card-text-match'
import { cardKeywords, typeBucketMatches } from './deck-lens'

export type TableZone = 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'benched'

export const ZONE_ORDER: TableZone[] = ['hero', 'equipment', 'maindeck', 'inventory', 'benched']

export interface DeckTableRow {
  key: string
  zone: TableZone
  name: string
  pitch: number | null
  cost: number | null
  power: number | null
  defense: number | null
  typeText: string
  qty: number
  printingIds: string[]
  details: NonNullable<DeckPrintingDTO['printingDetails']>
}

export type Lens = { stat: 'text' | 'type' | 'keyword'; value: string }
export type TableSortKey = 'qty' | 'name' | 'pitch' | 'cost' | 'power' | 'defense' | 'type' | 'zone'
export type TableSort = { key: TableSortKey; dir: 'asc' | 'desc' } | null

const num = (v: unknown) => (typeof v === 'number' ? v : null)

export function buildDeckTableRows(deck: DeckDTO): DeckTableRow[] {
  const rows: DeckTableRow[] = []
  for (const zone of ZONE_ORDER) {
    const byCard = new Map<string, DeckTableRow>()
    for (const c of (deck[zone] as DeckPrintingDTO[] | undefined) ?? []) {
      const d = c.printingDetails ?? {}
      const id = (d.card_unique_id as string | undefined) || c.printingId
      const existing = byCard.get(id)
      if (existing) {
        existing.qty += c.quantity ?? 1
        existing.printingIds.push(c.printingId)
        continue
      }
      byCard.set(id, {
        key: `${zone}:${id}`,
        zone,
        name: (d.display_name || d.name || '?') as string,
        pitch: num(d.pitch),
        cost: num(d.cost),
        power: num(d.power),
        defense: num(d.defense),
        typeText: (d.type_text_display as string | undefined) || (d.types ?? []).join(' ').replace(/\b\w/g, ch => ch.toUpperCase()),
        qty: c.quantity ?? 1,
        printingIds: [c.printingId],
        details: d,
      })
    }
    rows.push(...byCard.values())
  }
  return rows
}

const sortValue = (r: DeckTableRow, key: TableSortKey): number | string | null => {
  switch (key) {
    case 'zone': return ZONE_ORDER.indexOf(r.zone)
    case 'type': return r.typeText || null
    default: return r[key]
  }
}

function compare(a: number | string | null, b: number | string | null, dir: 1 | -1): number {
  if (a === b) return 0
  if (a === null) return 1 // blanks last, whichever direction
  if (b === null) return -1
  return (typeof a === 'string' ? a.localeCompare(b as string) : a - (b as number)) * dir
}

export function sortDeckTableRows(rows: DeckTableRow[], sort: TableSort): DeckTableRow[] {
  const byDefault = (a: DeckTableRow, b: DeckTableRow) =>
    compare(sortValue(a, 'zone'), sortValue(b, 'zone'), 1) ||
    compare(a.pitch, b.pitch, 1) ||
    a.name.localeCompare(b.name)
  if (!sort) return [...rows].sort(byDefault)
  const dir = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => compare(sortValue(a, sort.key), sortValue(b, sort.key), dir) || byDefault(a, b))
}

export function matchesLens(details: DeckTableRow['details'] | undefined, lens: Lens): boolean {
  if (lens.stat === 'text') return cardTextMatches(details?.text as string | undefined, lens.value)
  if (lens.stat === 'type') return typeBucketMatches(details?.types, lens.value)
  return cardKeywords(details).includes(lens.value.toLowerCase())
}

export function partitionByLens(rows: DeckTableRow[], lens: Lens): { matches: DeckTableRow[]; rest: DeckTableRow[] } {
  const matches: DeckTableRow[] = []
  const rest: DeckTableRow[] = []
  for (const r of rows) (matchesLens(r.details, lens) ? matches : rest).push(r)
  return { matches, rest }
}
