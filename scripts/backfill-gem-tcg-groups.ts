#!/usr/bin/env npx tsx
/**
 * One-shot backfill: stamp each GEM printing with the TCGplayer group id of the
 * seasonal "GEM Pack N" it belongs to (printings.tcg_group_id, migration 0067).
 *
 * Source of truth: tcgcsv's per-group product lists. Each product carries its
 * collector number (extendedData.Number, e.g. "GEM149") and its groupId. Our
 * GEM printings share the single `gem` set code but use that same continuous
 * GEM numbering, so collector_number -> group_id is an unambiguous mapping
 * (verified: every GEM number resolves to exactly one pack).
 *
 * Idempotent. Defaults to a DRY RUN; pass --commit to write.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-gem-tcg-groups.ts
 *   npx tsx --env-file=.env.local scripts/backfill-gem-tcg-groups.ts --commit
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { db } from '@/lib/postgres/db'
import { printings } from '@/lib/postgres/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'

// The seeded GEM groups (must already exist in tcg_groups — migration 0067).
const GEM_GROUPS: Record<number, string> = {
  24176: 'GEM Pack 1',
  24334: 'GEM Pack 2',
  24446: 'GEM Pack 3',
  24620: 'GEM Pack 4',
  24720: 'GEM Pack 5',
}
const TCGCSV_CATEGORY = 62 // Flesh and Blood
const UA = 'FaBBazaar-backfill/1.0 (tcg_group_id backfill)'

interface TcgProduct {
  productId: number
  groupId: number
  extendedData?: { name: string; value: string }[]
}

async function fetchGroupNumbers(groupId: number): Promise<string[]> {
  const url = `https://tcgcsv.com/tcgplayer/${TCGCSV_CATEGORY}/${groupId}/products`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`tcgcsv ${groupId} -> HTTP ${res.status}`)
  const body = (await res.json()) as { results?: TcgProduct[] }
  const numbers: string[] = []
  for (const p of body.results ?? []) {
    const num = p.extendedData?.find((e) => e.name === 'Number')?.value
    if (num) numbers.push(num.trim())
  }
  return numbers
}

async function main() {
  const commit = process.argv.includes('--commit')
  console.log(`\n=== GEM tcg_group_id backfill (${commit ? 'COMMIT' : 'DRY RUN'}) ===\n`)

  // 1. Build collector_number -> group_id from tcgcsv, flag ambiguity.
  const numToGroup = new Map<string, number>()
  const ambiguous: string[] = []
  for (const [gidStr, name] of Object.entries(GEM_GROUPS)) {
    const gid = Number(gidStr)
    const numbers = await fetchGroupNumbers(gid)
    console.log(`  ${name} (group ${gid}): ${numbers.length} products`)
    for (const num of numbers) {
      const existing = numToGroup.get(num)
      if (existing !== undefined && existing !== gid) ambiguous.push(num)
      else numToGroup.set(num, gid)
    }
  }
  console.log(`\nDistinct GEM collector numbers from tcgcsv: ${numToGroup.size}`)
  if (ambiguous.length) {
    console.error(`ABORT: ${ambiguous.length} collector numbers map to >1 group: ${ambiguous.slice(0, 10).join(', ')}`)
    process.exit(1)
  }

  // 2. Distinct collector numbers among our gem printings.
  const dbNums = await db
    .selectDistinct({ cn: printings.collectorNumber })
    .from(printings)
    .where(eq(printings.set, 'gem'))
  const matched: string[] = []
  const unmatched: string[] = []
  for (const { cn } of dbNums) {
    if (cn && numToGroup.has(cn)) matched.push(cn)
    else if (cn) unmatched.push(cn)
  }
  console.log(`Our gem collector numbers: ${dbNums.length} (matched ${matched.length}, unmatched ${unmatched.length})`)
  if (unmatched.length) console.log(`  Unmatched (left NULL): ${unmatched.sort().join(', ')}`)

  // 3. Apply. Group numbers by target group_id for a few bulk UPDATEs.
  const byGroup = new Map<number, string[]>()
  for (const cn of matched) {
    const gid = numToGroup.get(cn)!
    if (!byGroup.has(gid)) byGroup.set(gid, [])
    byGroup.get(gid)!.push(cn)
  }

  let totalRows = 0
  for (const [gid, nums] of byGroup) {
    if (commit) {
      const r = await db
        .update(printings)
        .set({ tcgGroupId: gid })
        .where(and(eq(printings.set, 'gem'), inArray(printings.collectorNumber, nums)))
      totalRows += r.rowCount ?? 0
    }
    console.log(`  ${GEM_GROUPS[gid]} (group ${gid}): ${nums.length} collector numbers`)
  }

  if (commit) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(printings)
      .where(and(eq(printings.set, 'gem'), sql`${printings.tcgGroupId} IS NOT NULL`))
    console.log(`\nCommitted. Updated ${totalRows} printing rows; ${count} gem printings now have tcg_group_id.`)
  } else {
    console.log(`\nDry run only. Re-run with --commit to write.`)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
