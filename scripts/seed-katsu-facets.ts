#!/usr/bin/env npx tsx
/**
 * One-shot seed: the first real curated card-facet dataset — the Tsunami Katsu
 * [Flood of Force] deck (Katsu, the Wanderer, Classic Constructed), classified
 * by hand against the v1 vocabulary in lib/search/card-facets.ts.
 *
 * Each name resolves to its card_unique_id(s); facet tags apply to ALL pitch
 * variants sharing the display name (handled by setCardFacetTags) and project
 * into cards.facet_tags for search. These tags are curation-owned and never
 * written by the data pipeline.
 *
 * Idempotent — setCardFacetTags REPLACES a card's tags, so re-running converges
 * to exactly this dataset.
 *
 * Usage:
 *   npx tsx scripts/seed-katsu-facets.ts
 *   npx tsx scripts/seed-katsu-facets.ts --dry-run
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { eq } from 'drizzle-orm'
import { db } from '@/lib/postgres/db'
import { cards } from '@/lib/postgres/schema'
import { printingsService } from '@/lib/services'
import { isFacetTag } from '@/lib/search/card-facets'

// name → facet tags. Final classification from the facet-vocabulary session.
// (Nullrune Gloves is intentionally untagged — its arcane-barrier keyword covers it.)
const CLASSIFICATIONS: Record<string, string[]> = {
  // Arena (equipment / weapons)
  'Breaking Scales': ['combo-buff', 'key-turn', 'combo-package'],
  'Breeze Rider Boots': ['chain-extender', 'combo-buff', 'beats-fatigue', 'key-turn', 'combo-package'],
  'Harmonized Kodachi': ['chain-extender'],
  'Heartened Cross Strap': ['chain-extender', 'cost-reduction', 'key-turn'],
  'Mask of the Pouncing Lynx': ['tutor', 'pseudo-draw', 'chain-extender', 'combo-enabler', 'key-turn', 'combo-package'],
  'Tiger Stripe Shuko': ['combo-buff', 'beats-fatigue'],
  'Wind Cutter': ['tutor', 'setup', 'combo-package'],

  // Deck — red
  'Bonds of Ancestry': ['tutor', 'chain-extender', 'combo-enabler', 'cost-reduction', 'setup', 'gustwave', 'dishonor-line', 'combo-package'],
  'Descendent Gustwave': ['chain-extender', 'cost-reduction', 'gustwave', 'dishonor-line', 'combo-package'],
  'Enact Vengeance': ['disruption', 'on-hit-payoff', 'vengeance', 'combo-package'],
  'Flic Flak': ['combo-buff', 'combo-package'],
  'Fluster Fist': ['scaling', 'beats-fatigue', 'combo-package'],
  'Gustwave of the Second Wind': ['chain-extender', 'gustwave', 'combo-package'],
  'Hundred Winds': ['chain-extender', 'scaling', 'beats-fatigue', 'winds-of-eternity-line', 'combo-package'],
  'Rushing River': ['chain-extender', 'pseudo-draw', 'combo-enabler', 'on-hit-payoff', 'top-deck-order', 'setup', 'flood-line', 'break-tide-line', 'combo-package'],
  'Surging Strike': ['chain-extender', 'lord-of-wind-line', 'dishonor-line', 'combo-package'],
  'Tigrine Reflex': ['chain-extender', 'combo-buff', 'setup', 'combo-package'],
  'Whelming Gustwave': ['chain-extender', 'pseudo-draw', 'on-hit-payoff', 'gustwave', 'lord-of-wind-line', 'combo-package'],

  // Deck — yellow
  'Break Tide': ['on-hit-payoff', 'pseudo-draw', 'beats-fatigue', 'break-tide-line', 'combo-package'],
  'Flood of Force': ['combo-enabler', 'pseudo-draw', 'chain-extender', 'density-dependent', 'flood-line', 'break-tide-line', 'combo-package'],
  'Remembrance': ['recursion', 'setup'],
  'Tempest Palm Gustwave': ['chain-extender', 'gustwave', 'combo-package'],

  // Deck — blue
  'Ancestral Harmony': ['combo-buff', 'pseudo-draw', 'chain-extender', 'combo-enabler', 'combo-package'],
  'Dishonor': ['disruption', 'on-hit-payoff', 'dishonor-line', 'combo-package'],
  'Find Center': ['on-hit-payoff', 'evasive', 'setup', 'combo-package'],
  'Retrace the Past': ['chain-extender', 'name-copy', 'setup', 'gustwave', 'combo-package'],
  'Silverwind Shuriken': ['combo-buff', 'combo-package'],
  'Winds of Eternity': ['on-hit-payoff', 'recursion', 'setup', 'winds-of-eternity-line', 'combo-package'],

  // Hero
  'Katsu, the Wanderer': ['tutor', 'chain-extender', 'combo-enabler', 'combo-package'],
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  // Fail fast if any tag drifted from the vocabulary.
  const badTags = [...new Set(Object.values(CLASSIFICATIONS).flat())].filter((t) => !isFacetTag(t))
  if (badTags.length) {
    console.error(`❌ tags not in vocabulary: ${badTags.join(', ')}`)
    process.exit(1)
  }

  const names = Object.keys(CLASSIFICATIONS)
  console.log(`${dryRun ? '[dry-run] ' : ''}Seeding ${names.length} cards…\n`)

  let ok = 0
  const missing: string[] = []

  for (const name of names) {
    const tags = CLASSIFICATIONS[name]
    const [row] = await db
      .select({ id: cards.cardUniqueId })
      .from(cards)
      .where(eq(cards.displayName, name))
      .limit(1)

    if (!row) {
      missing.push(name)
      console.log(`  ⚠️  NOT FOUND: ${name}`)
      continue
    }

    if (dryRun) {
      console.log(`  • ${name} → ${tags.join(', ')}`)
      ok++
      continue
    }

    const res = await printingsService.setCardFacetTags(row.id, tags)
    if (res.success) {
      console.log(`  ✓ ${name} → ${tags.length} tag(s), applied to ${res.data.applied} variant row(s)`)
      ok++
    } else {
      console.log(`  ✗ ${name}: ${res.error}`)
    }
  }

  console.log(`\nDone: ${ok}/${names.length} cards${missing.length ? `, ${missing.length} missing` : ''}.`)
  if (missing.length) {
    console.log(`Missing (display_name mismatch?): ${missing.join(', ')}`)
  }
  process.exit(missing.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
