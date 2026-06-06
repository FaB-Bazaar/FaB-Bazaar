/**
 * Integration tests for the refined banned_cards taxonomy (Phase 1).
 *
 * FaB has four distinct restriction states, not one. This pins the two new
 * statuses — `benched` (Silver Age, time-boxed) and `living_legend` (adult
 * hero pseudo-ban) — plus the benching-window columns (date_expires / until_set
 * / reason) round-tripping through upsert → listByFormat.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { inArray } from 'drizzle-orm'
import { db } from '@/lib/postgres/db'
import { cards, bannedCards } from '@/lib/postgres/schema'
import { PostgresBannedCardsService } from './PostgresBannedCardsService'

const service = new PostgresBannedCardsService()

let cardId: string

beforeEach(async () => {
  const suffix = crypto.randomUUID().slice(0, 8)
  cardId = `test-tax-${suffix}`
  await db.insert(cards).values({
    cardUniqueId: cardId,
    name: `test tax ${suffix}`,
    displayName: `Test Tax ${suffix}`,
    isHero: true,
  })
})

afterEach(async () => {
  await db.delete(bannedCards).where(inArray(bannedCards.cardUniqueId, [cardId]))
  await db.delete(cards).where(inArray(cards.cardUniqueId, [cardId]))
})

describe('banned_cards taxonomy: benched status + window', () => {
  it('stores a benched entry with a from/until window and reason, round-tripping through listByFormat', async () => {
    const res = await service.upsert({
      cardUniqueId: cardId,
      format: 'silver_age',
      restrictionType: 'benched',
      dateInEffect: '2026-05-29T00:00:00.000Z',
      dateExpires: '2026-12-01T00:00:00.000Z',
      untilSet: 'Set 20',
      reason: 'community_vote',
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.restrictionType).toBe('benched')
    expect(res.data.dateExpires).toBe('2026-12-01T00:00:00.000Z')
    expect(res.data.untilSet).toBe('Set 20')
    expect(res.data.reason).toBe('community_vote')

    const list = await service.listByFormat('silver_age', { includeInactive: true })
    expect(list.success).toBe(true)
    if (!list.success) return
    const row = list.data.find(r => r.cardUniqueId === cardId)
    expect(row?.restrictionType).toBe('benched')
    expect(row?.dateExpires).toBe('2026-12-01T00:00:00.000Z')
    expect(row?.untilSet).toBe('Set 20')
    expect(row?.reason).toBe('community_vote')
  })
})

describe('banned_cards taxonomy: living_legend status', () => {
  it('stores a living_legend entry for an adult hero', async () => {
    const res = await service.upsert({
      cardUniqueId: cardId,
      format: 'classic_constructed',
      restrictionType: 'living_legend',
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.restrictionType).toBe('living_legend')
  })
})

describe('banned_cards taxonomy: window fields default to null', () => {
  it('leaves date_expires / until_set / reason null for a plain ban', async () => {
    const res = await service.upsert({
      cardUniqueId: cardId,
      format: 'classic_constructed',
      restrictionType: 'banned',
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.dateExpires).toBeNull()
    expect(res.data.untilSet).toBeNull()
    expect(res.data.reason).toBeNull()
  })
})
