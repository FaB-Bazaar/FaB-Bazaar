/**
 * Integration test for the legacy-restriction recategorization (Phase 3).
 *
 * The registry historically crammed three FaB concepts into restriction_type='banned':
 *   - true bans (non-hero cards)        → stay 'banned'
 *   - Living Legend graduates (CC heroes) → become 'living_legend'
 *   - benched Silver Age heroes          → become 'benched'
 *
 * Migration 0057 recategorizes by is_hero and fixes the denormalized cards.*
 * columns to match. This seeds one of each shape, runs the real migration file,
 * and asserts the end state. Runs against real Postgres.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/postgres/db'
import { cards, bannedCards } from '@/lib/postgres/schema'

const MIGRATION = join(process.cwd(), 'lib/postgres/migrations/0057_recategorize_legacy_restrictions.sql')

let ccHero: string
let ccCard: string
let saHero: string
let saCard: string
let ids: string[]
let rowIds: string[]

async function status(rowId: string) {
  const [r] = await db.select().from(bannedCards).where(eq(bannedCards.id, rowId)).limit(1)
  return r
}
async function card(cardId: string) {
  const [r] = await db.select().from(cards).where(eq(cards.cardUniqueId, cardId)).limit(1)
  return r
}

beforeEach(async () => {
  const s = crypto.randomUUID().slice(0, 8)
  ccHero = `test-cchero-${s}`; ccCard = `test-cccard-${s}`
  saHero = `test-sahero-${s}`; saCard = `test-sacard-${s}`
  ids = [ccHero, ccCard, saHero, saCard]
  rowIds = ids.map(i => `row-${i}`)

  await db.insert(cards).values([
    { cardUniqueId: ccHero, name: `cc hero ${s}`, displayName: `CC Hero ${s}`, isHero: true, ccLegal: true, llLegal: false, ccBanned: true },
    { cardUniqueId: ccCard, name: `cc card ${s}`, displayName: `CC Card ${s}`, isHero: false, ccBanned: true },
    { cardUniqueId: saHero, name: `sa hero ${s}`, displayName: `SA Hero ${s}`, isHero: true, silverAgeBanned: true },
    { cardUniqueId: saCard, name: `sa card ${s}`, displayName: `SA Card ${s}`, isHero: false, silverAgeBanned: true },
  ])
  await db.insert(bannedCards).values([
    { id: rowIds[0], cardUniqueId: ccHero, format: 'classic_constructed', restrictionType: 'banned', statusActive: true, updatedAt: new Date() },
    { id: rowIds[1], cardUniqueId: ccCard, format: 'classic_constructed', restrictionType: 'banned', statusActive: true, updatedAt: new Date() },
    { id: rowIds[2], cardUniqueId: saHero, format: 'silver_age', restrictionType: 'banned', statusActive: true, updatedAt: new Date() },
    { id: rowIds[3], cardUniqueId: saCard, format: 'silver_age', restrictionType: 'banned', statusActive: true, updatedAt: new Date() },
  ])
})

afterEach(async () => {
  await db.delete(bannedCards).where(inArray(bannedCards.cardUniqueId, ids))
  await db.delete(cards).where(inArray(cards.cardUniqueId, ids))
})

describe('migration 0057: recategorize legacy restrictions', () => {
  it('turns CC banned heroes into living_legend and fixes legality flags', async () => {
    await db.execute(sql.raw(readFileSync(MIGRATION, 'utf8')))

    expect((await status(rowIds[0])).restrictionType).toBe('living_legend')
    const c = await card(ccHero)
    expect(c.ccBanned).toBe(false)
    expect(c.ccLegal).toBe(false)
    expect(c.llLegal).toBe(true)
  })

  it('turns SA banned heroes into benched and sets silver_age_suspended', async () => {
    await db.execute(sql.raw(readFileSync(MIGRATION, 'utf8')))

    expect((await status(rowIds[2])).restrictionType).toBe('benched')
    const c = await card(saHero)
    expect(c.silverAgeBanned).toBe(false)
    expect(c.silverAgeSuspended).toBe(true)
  })

  it('leaves true (non-hero) bans untouched', async () => {
    await db.execute(sql.raw(readFileSync(MIGRATION, 'utf8')))

    expect((await status(rowIds[1])).restrictionType).toBe('banned') // CC non-hero
    expect((await status(rowIds[3])).restrictionType).toBe('banned') // SA non-hero
    expect((await card(ccCard)).ccBanned).toBe(true)
    expect((await card(saCard)).silverAgeBanned).toBe(true)
  })
})
