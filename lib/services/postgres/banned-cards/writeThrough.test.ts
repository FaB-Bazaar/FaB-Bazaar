/**
 * Integration tests for the generalized write-through (Phase 2).
 *
 * Every registry mutation re-projects the relevant denormalized `cards` columns
 * so the deck-builder search/validation stay consistent with the registry:
 *   banned        → {format}_banned
 *   restricted    → ll_restricted (LL)
 *   benched       → silver_age_suspended (only while in the [from, until) window)
 *   living_legend → cc_legal=false, ll_legal=true
 *
 * Exercised through the PUBLIC API (upsert / setActive) against real Postgres.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/postgres/db'
import { cards, bannedCards } from '@/lib/postgres/schema'
import { PostgresBannedCardsService } from './PostgresBannedCardsService'

const service = new PostgresBannedCardsService()

let cardId: string

async function readCard() {
  const [row] = await db.select().from(cards).where(eq(cards.cardUniqueId, cardId)).limit(1)
  return row
}

beforeEach(async () => {
  const suffix = crypto.randomUUID().slice(0, 8)
  cardId = `test-wt-${suffix}`
  await db.insert(cards).values({
    cardUniqueId: cardId,
    name: `test wt ${suffix}`,
    displayName: `Test WT ${suffix}`,
    isHero: true,
    ccLegal: true,
    llLegal: false,
  })
})

afterEach(async () => {
  await db.delete(bannedCards).where(inArray(bannedCards.cardUniqueId, [cardId]))
  await db.delete(cards).where(inArray(cards.cardUniqueId, [cardId]))
})

describe('write-through: banned → {format}_banned', () => {
  it('sets cc_banned true on add and false on deactivate', async () => {
    const res = await service.upsert({ cardUniqueId: cardId, format: 'classic_constructed', restrictionType: 'banned' })
    expect(res.success).toBe(true)
    expect((await readCard()).ccBanned).toBe(true)

    if (res.success) await service.setActive(res.data.id, false)
    expect((await readCard()).ccBanned).toBe(false)
  })
})

describe('write-through: restricted → ll_restricted', () => {
  it('sets ll_restricted true on add and false on deactivate', async () => {
    const res = await service.upsert({ cardUniqueId: cardId, format: 'living_legend', restrictionType: 'restricted' })
    expect(res.success).toBe(true)
    expect((await readCard()).llRestricted).toBe(true)

    if (res.success) await service.setActive(res.data.id, false)
    expect((await readCard()).llRestricted).toBe(false)
  })
})

describe('write-through: benched → silver_age_suspended (window-aware)', () => {
  it('sets silver_age_suspended true while in the [from, until) window', async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString()
    const future = new Date(Date.now() + 86_400_000).toISOString()
    const res = await service.upsert({
      cardUniqueId: cardId, format: 'silver_age', restrictionType: 'benched',
      dateInEffect: past, dateExpires: future,
    })
    expect(res.success).toBe(true)
    expect((await readCard()).silverAgeSuspended).toBe(true)
  })

  it('leaves silver_age_suspended false once the window has expired', async () => {
    const longAgo = new Date(Date.now() - 2 * 86_400_000).toISOString()
    const past = new Date(Date.now() - 86_400_000).toISOString()
    const res = await service.upsert({
      cardUniqueId: cardId, format: 'silver_age', restrictionType: 'benched',
      dateInEffect: longAgo, dateExpires: past,
    })
    expect(res.success).toBe(true)
    expect((await readCard()).silverAgeSuspended).toBe(false)
  })
})

describe('write-through: living_legend → legality flags', () => {
  it('flips cc_legal false and ll_legal true when an adult hero graduates', async () => {
    expect((await readCard()).ccLegal).toBe(true)
    const res = await service.upsert({ cardUniqueId: cardId, format: 'classic_constructed', restrictionType: 'living_legend' })
    expect(res.success).toBe(true)

    const after = await readCard()
    expect(after.ccLegal).toBe(false)
    expect(after.llLegal).toBe(true)
  })
})
