import { db } from '@/lib/postgres/db'
import { bannedCards, cards } from '@/lib/postgres/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type {
  BannedCardDTO,
  BannedCardSyncResult,
  BannedCardUpsertInput,
  BannedFormat,
  IBannedCardsService,
  RestrictionType,
} from '../../contracts/IBannedCardsService'
import type { AsyncResult } from '../../contracts/common'

type BannedCardRow = typeof bannedCards.$inferSelect

/**
 * Drizzle wraps pg errors so `.message` is just `"Failed query: <sql>"` and
 * the real cause sits in `.cause`. Walk the cause chain to pull pg-specific
 * fields (code / detail / hint) so admins see a useful error.
 */
function describeError(err: unknown, fallback: string): string {
  console.error('[BannedCardsService]', fallback, err)
  if (!(err instanceof Error)) return fallback
  let cause: unknown = err
  let pgLike: any = null
  while (cause instanceof Error) {
    const c: any = cause
    if (typeof c.code === 'string' || c.severity || c.detail || c.hint) {
      pgLike = c
      break
    }
    cause = c.cause
  }
  if (pgLike) {
    const parts = [
      pgLike.code ? `[${pgLike.code}]` : null,
      pgLike.message,
      pgLike.detail ? `detail: ${pgLike.detail}` : null,
      pgLike.hint ? `hint: ${pgLike.hint}` : null,
    ].filter(Boolean)
    return parts.join(' — ')
  }
  return err.message || fallback
}

function toDTO(row: BannedCardRow): BannedCardDTO {
  return {
    id: row.id,
    cardUniqueId: row.cardUniqueId,
    format: row.format as BannedFormat,
    restrictionType: row.restrictionType as RestrictionType,
    sourceUniqueId: row.sourceUniqueId ?? null,
    statusActive: row.statusActive,
    dateAnnounced: row.dateAnnounced ? row.dateAnnounced.toISOString() : null,
    dateInEffect: row.dateInEffect ? row.dateInEffect.toISOString() : null,
    dateExpires: row.dateExpires ? row.dateExpires.toISOString() : null,
    untilSet: row.untilSet ?? null,
    reason: (row.reason as BannedCardDTO['reason']) ?? null,
    legalityArticle: row.legalityArticle ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toDate(value?: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

// Map a BannedFormat to the denormalized boolean column on `cards` that the
// deck-builder search reads. Formats without a dedicated column (clash, draft,
// etc.) are no-ops — the registry is still authoritative; nothing to write
// through. Restricted-only entries don't flip the column either.
const FORMAT_TO_CARDS_BANNED_COLUMN: Partial<Record<BannedFormat, keyof typeof cards.$inferSelect>> = {
  silver_age: 'silverAgeBanned',
  classic_constructed: 'ccBanned',
  living_legend: 'llBanned',
  blitz: 'blitzBanned',
  commoner: 'commonerBanned',
}

export class PostgresBannedCardsService implements IBannedCardsService {
  async listByFormat(
    format: BannedFormat,
    opts?: { includeInactive?: boolean; restrictionType?: RestrictionType },
  ): AsyncResult<BannedCardDTO[]> {
    try {
      const conditions = [eq(bannedCards.format, format)]
      if (!opts?.includeInactive) conditions.push(eq(bannedCards.statusActive, true))
      if (opts?.restrictionType) conditions.push(eq(bannedCards.restrictionType, opts.restrictionType))

      const rows = await db
        .select()
        .from(bannedCards)
        .where(and(...conditions))
        .orderBy(bannedCards.restrictionType, bannedCards.cardUniqueId)

      return { success: true, data: rows.map(toDTO) }
    } catch (err) {
      return { success: false, error: describeError(err, 'Failed to list banned cards') }
    }
  }

  private async hasActiveRestriction(cardUniqueId: string, format: BannedFormat, restrictionType: RestrictionType): AsyncResult<boolean> {
    try {
      const rows = await db
        .select({ id: bannedCards.id })
        .from(bannedCards)
        .where(
          and(
            eq(bannedCards.cardUniqueId, cardUniqueId),
            eq(bannedCards.format, format),
            eq(bannedCards.restrictionType, restrictionType),
            eq(bannedCards.statusActive, true),
          ),
        )
        .limit(1)
      return { success: true, data: rows.length > 0 }
    } catch (err) {
      return { success: false, error: describeError(err, 'Failed to check restriction status') }
    }
  }

  /**
   * Re-derive `cards.{format}_banned` from the current state of `banned_cards`.
   * The column is true iff there exists at least one active `restriction_type='banned'`
   * row for this (card, format). Idempotent — safe to call after any mutation.
   *
   * Without this, the registry (admin UI) and the denormalized `cards` flag (read
   * by the deck-builder search) drift out of sync and unbanned cards stay hidden.
   */
  private async recomputeCardsBannedFlag(cardUniqueId: string, format: BannedFormat): Promise<void> {
    const column = FORMAT_TO_CARDS_BANNED_COLUMN[format]
    if (!column) return

    const rows = await db
      .select({ id: bannedCards.id })
      .from(bannedCards)
      .where(
        and(
          eq(bannedCards.cardUniqueId, cardUniqueId),
          eq(bannedCards.format, format),
          eq(bannedCards.restrictionType, 'banned'),
          eq(bannedCards.statusActive, true),
        ),
      )
      .limit(1)

    const isBanned = rows.length > 0
    await db.update(cards).set({ [column]: isBanned }).where(eq(cards.cardUniqueId, cardUniqueId))
  }

  async isBanned(cardUniqueId: string, format: BannedFormat): AsyncResult<boolean> {
    return this.hasActiveRestriction(cardUniqueId, format, 'banned')
  }

  /**
   * Active banned hero card_unique_ids for a format.
   *
   * Joins `banned_cards` to `cards` to filter to heroes only — used by the
   * public hero-picker filter. After the registry seed of LL-attained heroes,
   * this captures both regular bans (rare for heroes) and LL-attained heroes
   * who were registered as banned in CC. Restricted-list rows are excluded.
   */
  async listBannedHeroIds(format: BannedFormat): AsyncResult<string[]> {
    try {
      const rows = await db
        .select({ cardUniqueId: bannedCards.cardUniqueId })
        .from(bannedCards)
        .innerJoin(cards, eq(cards.cardUniqueId, bannedCards.cardUniqueId))
        .where(
          and(
            eq(bannedCards.format, format),
            eq(bannedCards.restrictionType, 'banned'),
            eq(bannedCards.statusActive, true),
            eq(cards.isHero, true),
          ),
        )

      return { success: true, data: rows.map(r => r.cardUniqueId) }
    } catch (err) {
      return { success: false, error: describeError(err, 'Failed to list banned hero ids') }
    }
  }

  async isRestricted(cardUniqueId: string, format: BannedFormat): AsyncResult<boolean> {
    return this.hasActiveRestriction(cardUniqueId, format, 'restricted')
  }

  async upsert(input: BannedCardUpsertInput): AsyncResult<BannedCardDTO> {
    try {
      const now = new Date()
      const restrictionType = input.restrictionType ?? 'banned'
      const row = await db
        .insert(bannedCards)
        .values({
          id: nanoid(),
          cardUniqueId: input.cardUniqueId,
          format: input.format,
          restrictionType,
          sourceUniqueId: input.sourceUniqueId ?? null,
          statusActive: input.statusActive ?? true,
          dateAnnounced: toDate(input.dateAnnounced),
          dateInEffect: toDate(input.dateInEffect),
          dateExpires: toDate(input.dateExpires),
          untilSet: input.untilSet ?? null,
          reason: input.reason ?? null,
          legalityArticle: input.legalityArticle ?? null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [bannedCards.cardUniqueId, bannedCards.format, bannedCards.restrictionType],
          set: {
            sourceUniqueId: input.sourceUniqueId ?? null,
            statusActive: input.statusActive ?? true,
            dateAnnounced: toDate(input.dateAnnounced),
            dateInEffect: toDate(input.dateInEffect),
            dateExpires: toDate(input.dateExpires),
            untilSet: input.untilSet ?? null,
            reason: input.reason ?? null,
            legalityArticle: input.legalityArticle ?? null,
            updatedAt: now,
          },
        })
        .returning()

      if (!row[0]) {
        return { success: false, error: 'Upsert returned no row' }
      }
      await this.recomputeCardsBannedFlag(row[0].cardUniqueId, row[0].format as BannedFormat)
      return { success: true, data: toDTO(row[0]) }
    } catch (err) {
      return { success: false, error: describeError(err, 'Failed to upsert banned card') }
    }
  }

  async setActive(id: string, active: boolean): AsyncResult<BannedCardDTO> {
    try {
      const row = await db
        .update(bannedCards)
        .set({ statusActive: active, updatedAt: new Date() })
        .where(eq(bannedCards.id, id))
        .returning()
      if (!row[0]) return { success: false, error: 'Banned card not found' }
      await this.recomputeCardsBannedFlag(row[0].cardUniqueId, row[0].format as BannedFormat)
      return { success: true, data: toDTO(row[0]) }
    } catch (err) {
      return { success: false, error: describeError(err, 'Failed to update ban status') }
    }
  }

  async deleteById(id: string): AsyncResult<void> {
    try {
      const deleted = await db.delete(bannedCards).where(eq(bannedCards.id, id)).returning()
      if (deleted[0]) {
        await this.recomputeCardsBannedFlag(deleted[0].cardUniqueId, deleted[0].format as BannedFormat)
      }
      return { success: true, data: undefined }
    } catch (err) {
      return { success: false, error: describeError(err, 'Failed to delete banned card') }
    }
  }

  async syncFromUpstream(
    format: BannedFormat,
    restrictionType: RestrictionType,
    entries: Array<{
      card_unique_id: string
      unique_id?: string
      status_active?: boolean
      date_announced?: string | null
      date_in_effect?: string | null
      legality_article?: string | null
    }>,
  ): AsyncResult<BannedCardSyncResult> {
    try {
      const now = new Date()
      const existingRows = await db
        .select()
        .from(bannedCards)
        .where(and(eq(bannedCards.format, format), eq(bannedCards.restrictionType, restrictionType))!)

      const existingByCard = new Map(existingRows.map(r => [r.cardUniqueId, r]))

      // Upstream JSON can contain multiple historical rows per card_unique_id
      // (ban / unban / re-ban over time). Keep the latest one by date_in_effect
      // (falling back to array order, which is chronological in FaB-cube JSON).
      const latestByCard = new Map<string, typeof entries[number]>()
      for (const e of entries) {
        const current = latestByCard.get(e.card_unique_id)
        if (!current) {
          latestByCard.set(e.card_unique_id, e)
          continue
        }
        const a = e.date_in_effect ? Date.parse(e.date_in_effect) : 0
        const b = current.date_in_effect ? Date.parse(current.date_in_effect) : 0
        if (a >= b) latestByCard.set(e.card_unique_id, e)
      }
      const deduped = Array.from(latestByCard.values())
      const upstreamIds = new Set(deduped.map(e => e.card_unique_id))

      let added = 0
      let updated = 0
      let unchanged = 0
      let deactivated = 0

      for (const entry of deduped) {
        const statusActive = entry.status_active ?? true
        const existing = existingByCard.get(entry.card_unique_id)
        if (!existing) {
          await db.insert(bannedCards).values({
            id: nanoid(),
            cardUniqueId: entry.card_unique_id,
            format,
            restrictionType,
            sourceUniqueId: entry.unique_id ?? null,
            statusActive,
            dateAnnounced: toDate(entry.date_announced),
            dateInEffect: toDate(entry.date_in_effect),
            legalityArticle: entry.legality_article ?? null,
            updatedAt: now,
          })
          added++
        } else {
          const needsUpdate =
            existing.statusActive !== statusActive ||
            existing.sourceUniqueId !== (entry.unique_id ?? null) ||
            (existing.dateAnnounced?.toISOString() ?? null) !== (entry.date_announced ?? null) ||
            (existing.dateInEffect?.toISOString() ?? null) !== (entry.date_in_effect ?? null) ||
            existing.legalityArticle !== (entry.legality_article ?? null)
          if (needsUpdate) {
            await db
              .update(bannedCards)
              .set({
                statusActive,
                sourceUniqueId: entry.unique_id ?? null,
                dateAnnounced: toDate(entry.date_announced),
                dateInEffect: toDate(entry.date_in_effect),
                legalityArticle: entry.legality_article ?? null,
                updatedAt: now,
              })
              .where(eq(bannedCards.id, existing.id))
            updated++
          } else {
            unchanged++
          }
        }
      }

      // Deactivate rows that were active locally but missing upstream
      const stale = existingRows.filter(r => r.statusActive && !upstreamIds.has(r.cardUniqueId))
      if (stale.length > 0) {
        await db
          .update(bannedCards)
          .set({ statusActive: false, updatedAt: now })
          .where(inArray(bannedCards.id, stale.map(r => r.id)))
        deactivated = stale.length
      }

      // Re-derive the denormalized `cards.{format}_banned` flag for every card
      // touched in this sync (newly banned, updated, or stale-deactivated).
      const touchedCardIds = new Set<string>([
        ...deduped.map(e => e.card_unique_id),
        ...stale.map(r => r.cardUniqueId),
      ])
      for (const cardUniqueId of touchedCardIds) {
        await this.recomputeCardsBannedFlag(cardUniqueId, format)
      }

      return {
        success: true,
        data: { format, restrictionType, added, updated, deactivated, unchanged },
      }
    } catch (err) {
      return { success: false, error: describeError(err, 'Failed to sync banned cards') }
    }
  }
}
