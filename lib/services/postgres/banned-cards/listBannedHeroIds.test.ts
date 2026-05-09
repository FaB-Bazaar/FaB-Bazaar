/**
 * Integration test for PostgresBannedCardsService.listBannedHeroIds.
 *
 * Returns the active banned hero card_unique_ids for a format. Used by the
 * public GET /api/banned-cards/heroes endpoint and indirectly by the four UI
 * surfaces (decks/to-beat, decks/community, DeckMatchupsDialog, MatchupArena)
 * that filter their hero pickers.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/postgres/db'
import { cards, bannedCards } from '@/lib/postgres/schema'
import { PostgresBannedCardsService } from './PostgresBannedCardsService'

const service = new PostgresBannedCardsService()

let heroCardId: string
let weaponCardId: string
let bannedHeroRowId: string
let bannedWeaponRowId: string

beforeEach(async () => {
  // Use a deterministic test-prefix so cleanup is targeted and races are obvious.
  const suffix = crypto.randomUUID().slice(0, 8)
  heroCardId = `test-hero-${suffix}`
  weaponCardId = `test-weapon-${suffix}`
  bannedHeroRowId = `test-banrow-h-${suffix}`
  bannedWeaponRowId = `test-banrow-w-${suffix}`

  await db.insert(cards).values([
    {
      cardUniqueId: heroCardId,
      name: `test hero ${suffix}`,
      displayName: `Test Hero ${suffix}`,
      isHero: true,
    },
    {
      cardUniqueId: weaponCardId,
      name: `test weapon ${suffix}`,
      displayName: `Test Weapon ${suffix}`,
      isHero: false,
    },
  ])

  await db.insert(bannedCards).values([
    {
      id: bannedHeroRowId,
      cardUniqueId: heroCardId,
      format: 'classic_constructed',
      restrictionType: 'banned',
      statusActive: true,
      updatedAt: new Date(),
    },
    {
      id: bannedWeaponRowId,
      cardUniqueId: weaponCardId,
      format: 'classic_constructed',
      restrictionType: 'banned',
      statusActive: true,
      updatedAt: new Date(),
    },
  ])
})

afterEach(async () => {
  await db.delete(bannedCards).where(inArray(bannedCards.id, [bannedHeroRowId, bannedWeaponRowId]))
  await db.delete(cards).where(inArray(cards.cardUniqueId, [heroCardId, weaponCardId]))
})

describe('PostgresBannedCardsService.listBannedHeroIds', () => {
  it('returns hero card_unique_ids only — non-hero banned cards are excluded', async () => {
    const result = await service.listBannedHeroIds('classic_constructed')
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data).toContain(heroCardId)
    expect(result.data).not.toContain(weaponCardId)
  })

  it('excludes inactive ban rows', async () => {
    await db
      .update(bannedCards)
      .set({ statusActive: false })
      .where(eq(bannedCards.id, bannedHeroRowId))

    const result = await service.listBannedHeroIds('classic_constructed')
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data).not.toContain(heroCardId)
  })

  it('excludes restricted (1-of) rows — only restriction_type=banned counts', async () => {
    await db
      .update(bannedCards)
      .set({ restrictionType: 'restricted' })
      .where(eq(bannedCards.id, bannedHeroRowId))

    const result = await service.listBannedHeroIds('classic_constructed')
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data).not.toContain(heroCardId)
  })

  it('scopes results to the requested format', async () => {
    const result = await service.listBannedHeroIds('silver_age')
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data).not.toContain(heroCardId)
  })
})
