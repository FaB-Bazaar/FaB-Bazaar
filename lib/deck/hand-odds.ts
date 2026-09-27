// Draw odds for deck v2 ratios: the chance a hand of N cards holds at least /
// exactly X of one measure (and Y of another), drawing without replacement
// from the library — the (multivariate) hypergeometric distribution. Cards
// that match BOTH measures count for both sides, so the library is split into
// four disjoint groups and every hand composition is summed.

import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService'
import { classifyDeckZone } from './classify-deck-zone'
import { measureMatches, type Measure } from './ratios'
import { printingTalisharId } from './matchup-lineup'

export interface LibrarySplit { aOnly: number; bOnly: number; both: number; neither: number }
export interface HandCondition { mode: 'atLeast' | 'exactly'; count: number }

/** A saved matchup plan's swaps (decks.metadata.matchups[].sideboard), as
 *  Talishar card ids: `out` leave the main deck, `in` come from inventory. */
export interface MatchupSwaps { in: string[]; out: string[] }

/** Library = main-deck cards that are drawn — equipment/weapons filed in the
 *  main deck start in play (classifyDeckZone), so they're left out; inventory
 *  never counts unless a matchup plan sides a card in. */
export function librarySplit(deck: DeckDTO, a: Measure, b?: Measure, matchup?: MatchupSwaps): LibrarySplit {
  const inLibrary = (c: DeckPrintingDTO) => classifyDeckZone(c, 'maindeck') === 'maindeck'
  const entries = (deck.maindeck ?? []).filter(inLibrary).map(c => ({ card: c, id: printingTalisharId(c), qty: c.quantity ?? 1 }))

  if (matchup) {
    for (const id of matchup.out ?? []) {
      const e = entries.find(x => x.id === id && x.qty > 0)
      if (e) e.qty -= 1
    }
    for (const id of matchup.in ?? []) {
      const e = entries.find(x => x.id === id)
      if (e) { e.qty += 1; continue }
      const inv = (deck.inventory ?? []).find(c => printingTalisharId(c) === id)
      if (inv && inLibrary(inv)) entries.push({ card: inv, id, qty: 1 })
    }
  }

  const split: LibrarySplit = { aOnly: 0, bOnly: 0, both: 0, neither: 0 }
  for (const { card, qty } of entries) {
    if (qty <= 0) continue
    const inA = measureMatches(card.printingDetails, a)
    const inB = b ? measureMatches(card.printingDetails, b) : false
    if (inA && inB) split.both += qty
    else if (inA) split.aOnly += qty
    else if (inB) split.bOnly += qty
    else split.neither += qty
  }
  return split
}

function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= Math.min(k, n - k); i++) r = (r * (n - Math.min(k, n - k) + i)) / i
  return r
}

const meets = (v: number, c: HandCondition) => (c.mode === 'exactly' ? v === c.count : v >= c.count)

/** P(hand of `handSize` meets condA [and condB]); the hand is capped at the library size. */
export function handOdds(split: LibrarySplit, handSize: number, condA: HandCondition, condB?: HandCondition): number {
  const N = split.aOnly + split.bOnly + split.both + split.neither
  if (N === 0) return 0
  const n = Math.max(0, Math.min(Math.floor(handSize), N))
  const total = comb(N, n)
  let hits = 0
  for (let x = 0; x <= Math.min(n, split.aOnly); x++) {
    for (let y = 0; y <= Math.min(n - x, split.bOnly); y++) {
      for (let z = 0; z <= Math.min(n - x - y, split.both); z++) {
        const w = n - x - y - z
        if (w > split.neither) continue
        if (!meets(x + z, condA) || (condB && !meets(y + z, condB))) continue
        hits += comb(split.aOnly, x) * comb(split.bOnly, y) * comb(split.both, z) * comb(split.neither, w)
      }
    }
  }
  return hits / total
}
