/**
 * Integration test for PostgresBannedCardsService.listExcludedHeroes (Phase 5).
 *
 * After recategorization, hero exclusion is status-aware per format:
 *   - Classic Constructed: banned + living_legend (graduates)
 *   - Silver Age:          banned + benched (only while in-window)
 *   - other formats:       banned
 *
 * Returns one entry per excluded hero with its status, so callers can both
 * exclude (matchup pickers) and label distinctly (create-deck badge).
 *
 * Runs against real Postgres.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { inArray } from 'drizzle-orm'
import { db } from '@/lib/postgres/db'
import { cards, bannedCards } from '@/lib/postgres/schema'
import { PostgresBannedCardsService } from './PostgresBannedCardsService'

const service = new PostgresBannedCardsService()

let llHero: string, ccCard: string, benchedHero: string, expiredHero: string
let ids: string[]

beforeEach(async () => {
  const s = crypto.randomUUID().slice(0, 8)
  llHero = `x-ll-${s}`; ccCard = `x-cc-${s}`; benchedHero = `x-bench-${s}`; expiredHero = `x-exp-${s}`
  ids = [llHero, ccCard, benchedHero, expiredHero]

  await db.insert(cards).values([
    { cardUniqueId: llHero, name: `ll ${s}`, displayName: `LL ${s}`, isHero: true },
    { cardUniqueId: ccCard, name: `cc ${s}`, displayName: `CC ${s}`, isHero: false },
    { cardUniqueId: benchedHero, name: `bn ${s}`, displayName: `BN ${s}`, isHero: true },
    { cardUniqueId: expiredHero, name: `ex ${s}`, displayName: `EX ${s}`, isHero: true },
  ])

  const now = Date.now()
  await db.insert(bannedCards).values([
    { id: `r-${llHero}`, cardUniqueId: llHero, format: 'classic_constructed', restrictionType: 'living_legend', statusActive: true, updatedAt: new Date() },
    { id: `r-${ccCard}`, cardUniqueId: ccCard, format: 'classic_constructed', restrictionType: 'banned', statusActive: true, updatedAt: new Date() },
    { id: `r-${benchedHero}`, cardUniqueId: benchedHero, format: 'silver_age', restrictionType: 'benched', statusActive: true, dateInEffect: new Date(now - 86_400_000), dateExpires: new Date(now + 86_400_000), updatedAt: new Date() },
    { id: `r-${expiredHero}`, cardUniqueId: expiredHero, format: 'silver_age', restrictionType: 'benched', statusActive: true, dateInEffect: new Date(now - 2 * 86_400_000), dateExpires: new Date(now - 86_400_000), updatedAt: new Date() },
  ])
})

afterEach(async () => {
  await db.delete(bannedCards).where(inArray(bannedCards.cardUniqueId, ids))
  await db.delete(cards).where(inArray(cards.cardUniqueId, ids))
})

describe('listExcludedHeroes', () => {
  it('includes living_legend heroes for Classic Constructed, with status', async () => {
    const res = await service.listExcludedHeroes('classic_constructed')
    expect(res.success).toBe(true)
    if (!res.success) return
    const hit = res.data.find(h => h.cardUniqueId === llHero)
    expect(hit?.status).toBe('living_legend')
  })

  it('excludes non-hero cards (heroes only)', async () => {
    const res = await service.listExcludedHeroes('classic_constructed')
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.map(h => h.cardUniqueId)).not.toContain(ccCard)
  })

  it('includes an in-window benched hero for Silver Age', async () => {
    const res = await service.listExcludedHeroes('silver_age')
    expect(res.success).toBe(true)
    if (!res.success) return
    const hit = res.data.find(h => h.cardUniqueId === benchedHero)
    expect(hit?.status).toBe('benched')
  })

  it('excludes a benched hero whose window has expired', async () => {
    const res = await service.listExcludedHeroes('silver_age')
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.map(h => h.cardUniqueId)).not.toContain(expiredHero)
  })
})
