#!/usr/bin/env npx tsx
/**
 * One-shot seed: register heroes who attained Living Legend status, plus their
 * signature weapons, as banned in Classic Constructed in the `banned_cards`
 * registry.
 *
 * Idempotent — re-running is safe; the (card_unique_id, format, restriction_type)
 * unique index ignores already-inserted rows. Also recomputes `cards.cc_banned`
 * at the end so the cached column stays consistent with the registry.
 *
 * Usage:
 *   npx tsx scripts/seed-cc-living-legend-bans.ts
 *   npx tsx scripts/seed-cc-living-legend-bans.ts --dry-run
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { db } from '@/lib/postgres/db'
import { bannedCards, cards } from '@/lib/postgres/schema'
import { sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'

interface SeedEntry {
  cardUniqueId: string
  label: string // human-readable, for logging only
}

const HEROES: SeedEntry[] = [
  { cardUniqueId: 'mHBtPppktRTkWpnf69dHj', label: 'Aurora, Shooting Star' },
  { cardUniqueId: 'PTFnJCdhWD9cFgMMNPqQj', label: 'Azalea, Ace in the Hole' },
  { cardUniqueId: 'PFJnMWQNfr6jMMzJhjB9H', label: 'Bravo, Star of the Show' },
  { cardUniqueId: 'cjDzkKdjNrGqL9tnDc7zd', label: 'Briar, Warden of Thorns' },
  { cardUniqueId: 'MhBTRHCCft7RbrMmkwwGw', label: 'Chane, Bound by Shadow' },
  { cardUniqueId: '6CcjWGnThrTmTQFQ9zHMN', label: 'Dash, Inventor Extraordinaire' },
  { cardUniqueId: 'PrJkWBKNgtNdzhqhWLGFw', label: 'Dromai, Ash Artist' },
  { cardUniqueId: 'tJhRRN9kkMCnGQdQJ8TWg', label: 'Enigma, Ledger of Ancestry' },
  { cardUniqueId: 'hjMQGwKgDTh8LzFdnk8Rg', label: 'Florian, Rotwood Harbinger' },
  { cardUniqueId: '8KRCDf6drqhFMKK7hJhbM', label: 'Iyslander, Stormbind' },
  { cardUniqueId: 'kRPqHdCckKBKfRwjbfzNT', label: 'Kano, Dracai of Aether' },
  { cardUniqueId: 'qdLHRPTdGkw6TjpMjPTW7', label: 'Kayo, Armed and Dangerous' },
  { cardUniqueId: 'PFmgFK9dFr8q6PrpJFpPG', label: 'Lexi, Livewire' },
  { cardUniqueId: 'MghLPDjq8CfBJ8RzNc7Ft', label: 'Nuu, Alluring Desire' },
  { cardUniqueId: 'bh96L8jp69mNpjcGRCDbj', label: 'Oldhim, Grandfather of Eternity' },
  { cardUniqueId: 'F7rQpTDjHFWPgQhcGg7RT', label: 'Prism, Sculptor of Arc Light' },
  { cardUniqueId: 'wJMCMFqcQfRJmK96kc8qM', label: 'Verdance, Thorn of the Rose' },
  { cardUniqueId: 'TKbRWjjBLJThMmLkTFb6q', label: 'Viserai, Rune Blood' },
  { cardUniqueId: 'GDbCgdDrFKCWWthrgD6h6', label: 'Zen, Tamer of Purpose' },
]

// Bravo has no signature weapon; Winter's Wail (Oldhim) is already in the
// registry from a prior insert, so it's omitted here. ON CONFLICT DO NOTHING
// would skip it anyway, but listing fewer rows keeps logs honest.
const WEAPONS: SeedEntry[] = [
  { cardUniqueId: 'm7NGBRdNftTh9ntBzppbB', label: 'Star Fall (Aurora)' },
  { cardUniqueId: 'Nnmtz6GrR6MWMcptb6wD7', label: 'Death Dealer (Azalea)' },
  { cardUniqueId: 'cbHrfwmLrMjWdhdBtzbff', label: 'Rosetta Thorn (Briar)' },
  { cardUniqueId: 'r8Bq8zBCNdzGPkmMcr6QL', label: 'Galaxxi Black (Chane)' },
  { cardUniqueId: 'fNFqtdWLq6tCPnnwjLLWL', label: 'Teklo Plasma Pistol (Dash)' },
  { cardUniqueId: 'PQm7zFjBPCzc68JDd8D6z', label: 'Storm of Sandikai (Dromai)' },
  { cardUniqueId: 'zMC89pqnzTP7bkmfjmTzQ', label: 'Cosmo (Enigma)' },
  { cardUniqueId: 'HmQ8dbfPL8BLMkJDGGGm8', label: 'Rotwood Reaper (Florian)' },
  { cardUniqueId: 'Cd6PTGH6CqTHmt7LQmBMp', label: "Kraken's Aethervein (Iyslander)" },
  { cardUniqueId: 'nzDWrNMqGWgmJfgJhChNb', label: 'Crucible of Aetherweave (Kano)' },
  { cardUniqueId: 'PRzqJ97HHdM6f8bLKhGzQ', label: 'Mandible Claw (Kayo)' },
  { cardUniqueId: 'Nzpgn9HrbNfkzM8CkwCQp', label: 'Voltaire, Strike Twice (Lexi)' },
  { cardUniqueId: 'wcm8kJNcrzDtt6zJm9c9R', label: 'Beckoning Mistblade (Nuu)' },
  { cardUniqueId: 'TQ7Twhtm6zfkTTHTKdpJK', label: 'Luminaris (Prism)' },
  { cardUniqueId: 'PQgjdCTFwm89BmcWP9n7d', label: 'Staff of Verdant Shoots (Verdance)' },
  { cardUniqueId: 'RWwk8hgBdnRdWfjkrfJHt', label: 'Nebula Blade (Viserai)' },
  { cardUniqueId: 'M7nPGBJMNj6tbtDgzMNqc', label: 'Tiger Taming Khakkara (Zen)' },
]

const ALL = [...HEROES, ...WEAPONS]

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const now = new Date()

  console.log(`Seeding ${ALL.length} CC living-legend bans (${HEROES.length} heroes + ${WEAPONS.length} weapons)`)
  if (dryRun) console.log('DRY RUN — no inserts will be applied')

  const rows = ALL.map(entry => ({
    id: nanoid(),
    cardUniqueId: entry.cardUniqueId,
    format: 'classic_constructed' as const,
    restrictionType: 'banned' as const,
    statusActive: true,
    sourceUniqueId: null,
    dateAnnounced: null,
    dateInEffect: null,
    legalityArticle: null,
    updatedAt: now,
  }))

  if (!dryRun) {
    const inserted = await db
      .insert(bannedCards)
      .values(rows)
      .onConflictDoNothing({
        target: [bannedCards.cardUniqueId, bannedCards.format, bannedCards.restrictionType],
      })
      .returning({ id: bannedCards.id, cardUniqueId: bannedCards.cardUniqueId })

    const insertedIds = new Set(inserted.map(r => r.cardUniqueId))
    for (const entry of ALL) {
      const status = insertedIds.has(entry.cardUniqueId) ? '+ inserted' : '· already present'
      console.log(`  ${status}  ${entry.label}`)
    }
    console.log(`\n${inserted.length} new row(s) inserted; ${ALL.length - inserted.length} already present.`)

    // Recompute the denormalized cards.cc_banned column for every CC ban so
    // the cache stays consistent with the registry.
    await db.execute(sql`
      UPDATE ${cards} c
      SET cc_banned = EXISTS (
        SELECT 1 FROM ${bannedCards} bc
        WHERE bc.card_unique_id = c.card_unique_id
          AND bc.format = 'classic_constructed'
          AND bc.restriction_type = 'banned'
          AND bc.status_active = true
      )
    `)
    console.log('Refreshed cards.cc_banned cache.')
  }

  process.exit(0)
}

main().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
